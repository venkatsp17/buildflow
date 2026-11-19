package models

import (
	"errors"
	"math"
	"math/big"
	"regexp"
	"strconv"
)

var gstinPattern = regexp.MustCompile(`^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$`)
var hsnPattern = regexp.MustCompile(`^([0-9]{4}|[0-9]{6}|[0-9]{8})$`)

func ValidStateCode(code string) bool {
	switch code {
	case "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "26", "27", "29", "30", "31", "32", "33", "34", "35", "36", "37", "38":
		return true
	}
	return false
}

func ValidGSTIN(gstin string) bool {
	return gstinPattern.MatchString(gstin) && ValidStateCode(gstin[:2])
}

func TaxMode(supplierState, placeOfSupply string) (string, error) {
	if !ValidStateCode(supplierState) || !ValidStateCode(placeOfSupply) {
		return "", errors.New("select a valid supplier state and place of supply")
	}
	if supplierState != placeOfSupply {
		return "igst", nil
	}
	switch supplierState {
	case "04", "26", "31", "35", "38":
		return "cgst_utgst", nil
	default:
		return "cgst_sgst", nil
	}
}

func (p Product) ValidateTax() error {
	if p.GSTRate == nil || !validDecimal(*p.GSTRate, 100, 4) {
		return errors.New("configure a GST rate between 0 and 100 with up to four decimals")
	}
	if p.HSNCode != "" && !hsnPattern.MatchString(p.HSNCode) {
		return errors.New("HSN must contain 4, 6 or 8 digits")
	}
	switch p.TaxCategory {
	case "taxable":
		if *p.GSTRate <= 0 || p.HSNCode == "" {
			return errors.New("taxable products require an HSN code and a positive GST rate")
		}
	case "nil_rated", "exempt", "non_gst":
		if *p.GSTRate != 0 {
			return errors.New("nil-rated, exempt and non-GST products require a zero GST rate")
		}
	default:
		return errors.New("configure the product tax category")
	}
	return nil
}

// JSON numbers remain compatible with existing clients. All billing arithmetic
// uses exact decimal rationals, and persisted money uses explicit NUMERIC types.
func decimalNumber(value float64) *big.Rat {
	r, _ := new(big.Rat).SetString(strconv.FormatFloat(value, 'f', -1, 64))
	return r
}

func validDecimal(value, maximum float64, places int) bool {
	if math.IsNaN(value) || math.IsInf(value, 0) || value < 0 || value > maximum {
		return false
	}
	r := new(big.Rat).Mul(decimalNumber(value), big.NewRat(int64(math.Pow10(places)), 1))
	return r.IsInt()
}

func ValidUnitPrice(value float64) bool {
	return validDecimal(value, 1000000, 4)
}

// cents rounds non-negative decimal money half up to two decimal places.
func cents(value *big.Rat) int64 {
	scaled := new(big.Rat).Mul(value, big.NewRat(100, 1))
	q, remainder := new(big.Int), new(big.Int)
	q.QuoRem(scaled.Num(), scaled.Denom(), remainder)
	if new(big.Int).Mul(remainder, big.NewInt(2)).Cmp(scaled.Denom()) >= 0 {
		q.Add(q, big.NewInt(1))
	}
	return q.Int64()
}

func amount(cents int64) float64 { return float64(cents) / 100 }

// CalculateLegacyBilling supports existing clients until the configured catalog
// is ready and GST billing is explicitly enabled for the deployment.
func (item *OrderItem) CalculateLegacyBilling() error {
	if item.Quantity < 1 || item.Quantity > 100000 || !ValidUnitPrice(item.UnitPrice) {
		return errors.New("invalid quantity or unit price")
	}
	gross := cents(new(big.Rat).Mul(decimalNumber(item.UnitPrice), big.NewRat(int64(item.Quantity), 1)))
	item.GrossAmount, item.TaxableAmount, item.LineTotal = amount(gross), amount(gross), amount(gross)
	return nil
}

func (item *OrderItem) CalculateBilling(product Product, discount float64, mode string) error {
	if err := product.ValidateTax(); err != nil {
		return err
	}
	if !validDecimal(discount, 100, 4) {
		return errors.New("discount must be between 0 and 100 with up to four decimals")
	}
	if item.Quantity < 1 || item.Quantity > 100000 || !ValidUnitPrice(item.UnitPrice) {
		return errors.New("invalid quantity or pre-tax unit price")
	}
	gross := cents(new(big.Rat).Mul(decimalNumber(item.UnitPrice), big.NewRat(int64(item.Quantity), 1)))
	discountCents := cents(new(big.Rat).Mul(big.NewRat(gross, 10000), decimalNumber(discount)))
	taxable := gross - discountCents
	item.HSNCode, item.TaxCategory, item.GSTRate = product.HSNCode, product.TaxCategory, *product.GSTRate
	item.DiscountPercent, item.GrossAmount = discount, amount(gross)
	item.DiscountAmount, item.TaxableAmount = amount(discountCents), amount(taxable)
	rate := decimalNumber(*product.GSTRate)
	fullTax := new(big.Rat).Mul(big.NewRat(taxable, 10000), rate)
	var central, state, territory, integrated int64
	item.CGSTRate, item.SGSTRate, item.UTGSTRate, item.IGSTRate = 0, 0, 0, 0
	switch mode {
	case "cgst_sgst", "cgst_utgst":
		halfRate, _ := new(big.Rat).Quo(rate, big.NewRat(2, 1)).Float64()
		if !validDecimal(halfRate, 50, 4) {
			return errors.New("GST rate must split into components with up to four decimals")
		}
		central = cents(new(big.Rat).Quo(fullTax, big.NewRat(2, 1)))
		item.CGSTRate = halfRate
		if mode == "cgst_sgst" {
			state, item.SGSTRate = central, halfRate
		} else {
			territory, item.UTGSTRate = central, halfRate
		}
	case "igst":
		integrated, item.IGSTRate = cents(fullTax), *product.GSTRate
	default:
		return errors.New("invalid GST mode")
	}
	item.CGSTAmount, item.SGSTAmount = amount(central), amount(state)
	item.UTGSTAmount, item.IGSTAmount = amount(territory), amount(integrated)
	item.LineTotal = amount(taxable + central + state + territory + integrated)
	return nil
}

func (order *Order) CalculateTotals() {
	var gross, discount, taxable, central, state, territory, integrated int64
	for _, item := range order.Items {
		gross += cents(decimalNumber(item.GrossAmount))
		discount += cents(decimalNumber(item.DiscountAmount))
		taxable += cents(decimalNumber(item.TaxableAmount))
		central += cents(decimalNumber(item.CGSTAmount))
		state += cents(decimalNumber(item.SGSTAmount))
		territory += cents(decimalNumber(item.UTGSTAmount))
		integrated += cents(decimalNumber(item.IGSTAmount))
	}
	order.Subtotal, order.DiscountAmount, order.TaxableTotal = amount(gross), amount(discount), amount(taxable)
	order.CGSTTotal, order.SGSTTotal = amount(central), amount(state)
	order.UTGSTTotal, order.IGSTTotal = amount(territory), amount(integrated)
	order.TaxTotal = amount(central + state + territory + integrated)
	order.Value = amount(taxable + central + state + territory + integrated)
}
