package models

import (
	"math"
	"testing"
)

func TestProductDiscountBeforeGST(t *testing.T) {
	tests := []struct {
		name                                                                         string
		quantity                                                                     int
		price, discount, rate                                                        float64
		mode, category                                                               string
		gross, discountAmount, taxable, central, state, territory, integrated, total float64
	}{
		{"same state", 2, 500, 10, 18, "cgst_sgst", "taxable", 1000, 100, 900, 81, 81, 0, 0, 1062},
		{"interstate", 1, 500, 10, 5, "igst", "taxable", 500, 50, 450, 0, 0, 0, 22.5, 472.5},
		{"union territory", 1, 500, 10, 5, "cgst_utgst", "taxable", 500, 50, 450, 11.25, 0, 11.25, 0, 472.5},
		{"full discount", 3, 123.4567, 100, 18, "cgst_sgst", "taxable", 370.37, 370.37, 0, 0, 0, 0, 0, 0},
		{"half paise rounds up", 1, 1, 0.5, 18, "cgst_sgst", "taxable", 1, .01, .99, .09, .09, 0, 0, 1.17},
		{"fractional price", 3, .3333, 0, 5, "cgst_sgst", "taxable", 1, 0, 1, .03, .03, 0, 0, 1.06},
		{"exempt", 1, 100, 5, 0, "cgst_sgst", "exempt", 100, 5, 95, 0, 0, 0, 0, 95},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			product := Product{HSNCode: "2522", GSTRate: &tc.rate, TaxCategory: tc.category}
			item := OrderItem{Quantity: tc.quantity, UnitPrice: tc.price}
			if err := item.CalculateBilling(product, tc.discount, tc.mode); err != nil {
				t.Fatal(err)
			}
			actual := []float64{item.GrossAmount, item.DiscountAmount, item.TaxableAmount, item.CGSTAmount, item.SGSTAmount, item.UTGSTAmount, item.IGSTAmount, item.LineTotal}
			want := []float64{tc.gross, tc.discountAmount, tc.taxable, tc.central, tc.state, tc.territory, tc.integrated, tc.total}
			for i := range want {
				if actual[i] != want[i] {
					t.Fatalf("field %d: got %v, want %v", i, actual[i], want[i])
				}
			}
		})
	}
}

func TestMixedRatesAndDiscountTotals(t *testing.T) {
	order := Order{}
	for _, input := range []struct{ price, rate, discount float64 }{{1000, 18, 10}, {500, 5, 20}} {
		item := OrderItem{Quantity: 1, UnitPrice: input.price}
		if err := item.CalculateBilling(Product{HSNCode: "2522", GSTRate: &input.rate, TaxCategory: "taxable"}, input.discount, "cgst_sgst"); err != nil {
			t.Fatal(err)
		}
		order.Items = append(order.Items, item)
	}
	order.CalculateTotals()
	if order.Subtotal != 1500 || order.DiscountAmount != 200 || order.TaxableTotal != 1300 || order.CGSTTotal != 91 || order.SGSTTotal != 91 || order.TaxTotal != 182 || order.Value != 1482 {
		t.Fatalf("incorrect mixed-slab totals: %+v", order)
	}
	// Recalculation must replace, rather than accumulate, saved totals.
	order.CalculateTotals()
	if order.Value != 1482 {
		t.Fatal("recalculation changed total")
	}
}

func TestInvalidBillingInputs(t *testing.T) {
	rate := 18.0
	product := Product{HSNCode: "2522", GSTRate: &rate, TaxCategory: "taxable"}
	for _, discount := range []float64{-1, 101, .00001, math.NaN(), math.Inf(1)} {
		item := OrderItem{Quantity: 1, UnitPrice: 100}
		if item.CalculateBilling(product, discount, "cgst_sgst") == nil {
			t.Fatalf("accepted discount %v", discount)
		}
	}
	product.GSTRate = nil
	item := OrderItem{Quantity: 1, UnitPrice: 100}
	if item.CalculateBilling(product, 0, "cgst_sgst") == nil {
		t.Fatal("accepted unconfigured product")
	}
	zero := 0.0
	product.GSTRate = &zero
	if product.ValidateTax() == nil {
		t.Fatal("accepted taxable product with zero rate")
	}
}

func TestTaxJurisdiction(t *testing.T) {
	for _, tc := range []struct{ supplier, destination, mode string }{{"33", "33", "cgst_sgst"}, {"33", "29", "igst"}, {"04", "04", "cgst_utgst"}, {"07", "07", "cgst_sgst"}, {"34", "34", "cgst_sgst"}} {
		mode, err := TaxMode(tc.supplier, tc.destination)
		if err != nil || mode != tc.mode {
			t.Fatalf("incorrect jurisdiction: %v, %v", mode, err)
		}
	}
	if _, err := TaxMode("33", "99"); err == nil {
		t.Fatal("accepted invalid state")
	}
	if !ValidGSTIN("33AAECL4703G1ZW") || ValidGSTIN("33") {
		t.Fatal("incorrect GSTIN validation")
	}
}
