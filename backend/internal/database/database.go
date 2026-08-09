package database

import (
	"errors"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"tracker-backend/internal/models"
)

// Connect opens a GORM connection to Postgres, auto-migrates the schema, and
// seeds base reference data (customers/products) if the tables are empty.
func Connect(databaseURL string) (*gorm.DB, error) {
	db, err := gorm.Open(postgres.Open(databaseURL), &gorm.Config{})
	if err != nil {
		return nil, err
	}

	// Must run before AutoMigrate: it renames the old `email` login column to
	// `username` and backfills `name`/`must_reset_password` on any existing
	// rows, so AutoMigrate's NOT NULL constraints (from the current User
	// struct) have something valid to enforce rather than failing outright.
	if err := migrateUserIdentifierColumns(db); err != nil {
		return nil, err
	}

	if err := db.AutoMigrate(
		&models.PriceList{},
		&models.User{},
		&models.Customer{},
		&models.Product{},
		&models.PriceListItem{},
		&models.Order{},
		&models.OrderItem{},
		&models.Notification{},
		&models.PushToken{},
	); err != nil {
		return nil, err
	}

	if err := ensureSuperUserBootstrap(db); err != nil {
		return nil, err
	}

	if err := db.Exec("CREATE SEQUENCE IF NOT EXISTS order_ticket_seq START 2400").Error; err != nil {
		return nil, err
	}

	if err := db.Exec("ALTER TABLE orders DROP COLUMN IF EXISTS assignee_id").Error; err != nil {
		return nil, err
	}

	// One-time rename of the "done" status value to "delivered".
	if err := db.Exec("UPDATE orders SET status = 'delivered' WHERE status = 'done'").Error; err != nil {
		return nil, err
	}

	if err := seedBaseData(db); err != nil {
		return nil, err
	}

	return db, nil
}

// migrateUserIdentifierColumns handles the one-time move from email-based
// login to username-based login. On a brand-new database the `users` table
// doesn't exist yet, so there's nothing to migrate — AutoMigrate creates it
// with the current (username/name) shape directly.
func migrateUserIdentifierColumns(db *gorm.DB) error {
	var usersTableExists bool
	if err := db.Raw(`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users')`).Scan(&usersTableExists).Error; err != nil {
		return err
	}
	if !usersTableExists {
		return nil
	}

	var hasEmail, hasUsername bool
	if err := db.Raw(`SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'email')`).Scan(&hasEmail).Error; err != nil {
		return err
	}
	if err := db.Raw(`SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'username')`).Scan(&hasUsername).Error; err != nil {
		return err
	}
	if hasEmail && !hasUsername {
		if err := db.Exec(`ALTER TABLE users RENAME COLUMN email TO username`).Error; err != nil {
			return err
		}
	}

	if err := db.Exec(`ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT`).Error; err != nil {
		return err
	}
	// Existing accounts (created back when the only identifier was an email)
	// get their username as a placeholder display name — a manager can't
	// rename them today, but this beats a blank name.
	if err := db.Exec(`UPDATE users SET name = username WHERE name IS NULL`).Error; err != nil {
		return err
	}
	if err := db.Exec(`ALTER TABLE users ALTER COLUMN name SET NOT NULL`).Error; err != nil {
		return err
	}

	if err := db.Exec(`ALTER TABLE users ADD COLUMN IF NOT EXISTS must_reset_password BOOLEAN NOT NULL DEFAULT false`).Error; err != nil {
		return err
	}

	return nil
}

// ensureSuperUserBootstrap guarantees there's always at least one super user
// once a manager account exists — otherwise disabling accounts (super-user
// only, see middleware.RequireSuperUser) would be permanently unreachable
// through the API after this feature ships, with no way to grant the
// permission short of a manual DB edit. Nothing is hardcoded: the earliest
// manager account (by creation order) is promoted, and only if no super
// user exists yet — it never overrides one that's already been set or
// deliberately revoked.
func ensureSuperUserBootstrap(db *gorm.DB) error {
	var superUserCount int64
	if err := db.Model(&models.User{}).Where("role = ? AND is_super_user = ?", models.RoleManager, true).Count(&superUserCount).Error; err != nil {
		return err
	}
	if superUserCount > 0 {
		return nil
	}

	var earliestManager models.User
	err := db.Where("role = ?", models.RoleManager).Order("created_at asc, id asc").First(&earliestManager).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil
	}
	if err != nil {
		return err
	}

	return db.Model(&earliestManager).Update("is_super_user", true).Error
}

// seedBaseData inserts a starter Customer/Product catalog the first time the
// tables are empty, and backfills customer_id/product_id on any existing
// orders/items whose free-text names match a seeded record.
func seedBaseData(db *gorm.DB) error {
	var userCount int64
	if err := db.Model(&models.User{}).Count(&userCount).Error; err != nil {
		return err
	}
	if userCount == 0 {
		return nil
	}

	var firstUser models.User
	if err := db.Order("id asc").First(&firstUser).Error; err != nil {
		return err
	}

	var customerCount int64
	if err := db.Model(&models.Customer{}).Count(&customerCount).Error; err != nil {
		return err
	}
	if customerCount == 0 {
		baseCustomers := []models.Customer{
			{Name: "Al Futtaim Contracting", CreatedByID: firstUser.ID},
			{Name: "ALEC Engineering", CreatedByID: firstUser.ID},
			{Name: "Nakheel Construction", CreatedByID: firstUser.ID},
			{Name: "Emaar Properties", CreatedByID: firstUser.ID},
			{Name: "Dubai Properties Group", CreatedByID: firstUser.ID},
			{Name: "Meraas Holding", CreatedByID: firstUser.ID},
			{Name: "Arabtec Construction", CreatedByID: firstUser.ID},
			{Name: "DAMAC Properties", CreatedByID: firstUser.ID},
			{Name: "Sobha Realty", CreatedByID: firstUser.ID},
		}
		if err := db.Create(&baseCustomers).Error; err != nil {
			return err
		}
	}

	var productCount int64
	if err := db.Model(&models.Product{}).Count(&productCount).Error; err != nil {
		return err
	}
	if productCount == 0 {
		baseProducts := []models.Product{
			{Name: "Ready Mix Concrete C30", Unit: "m3", Description: "Grade C30, ready-mix", CreatedByID: firstUser.ID},
			{Name: "Rebar 12mm", Unit: "tons", Description: "12mm diameter, cut & bent", CreatedByID: firstUser.ID},
			{Name: "Steel Reinforcement Bars 16mm", Unit: "units", Description: "Grade 60, cut & bent", CreatedByID: firstUser.ID},
			{Name: "Cement Bags 50kg", Unit: "bags", Description: "OPC 53 grade", CreatedByID: firstUser.ID},
			{Name: "Glass Curtain Wall Panels", Unit: "units", Description: "Tempered, 12mm", CreatedByID: firstUser.ID},
			{Name: "Aluminum Formwork Panels", Unit: "units", Description: "Reusable formwork system panels", CreatedByID: firstUser.ID},
			{Name: "Precast Concrete Blocks", Unit: "units", Description: "400x200x200mm, load-bearing", CreatedByID: firstUser.ID},
			{Name: "PVC Conduit Pipes 25mm", Unit: "meters", Description: "Electrical conduit, UV-resistant", CreatedByID: firstUser.ID},
			{Name: "Structural Steel I-Beams", Unit: "tons", Description: "Grade 50, hot-rolled", CreatedByID: firstUser.ID},
			{Name: "Waterproofing Membrane Rolls", Unit: "rolls", Description: "APP modified bitumen, 4mm", CreatedByID: firstUser.ID},
			{Name: "Ceramic Floor Tiles 600x600", Unit: "m2", Description: "Matte finish, porcelain", CreatedByID: firstUser.ID},
			{Name: "HVAC Ducting Sheets", Unit: "sheets", Description: "Galvanized steel, 26 gauge", CreatedByID: firstUser.ID},
			{Name: "Electrical Cable Trays", Unit: "meters", Description: "Perforated, hot-dip galvanized", CreatedByID: firstUser.ID},
		}
		if err := db.Create(&baseProducts).Error; err != nil {
			return err
		}
	}

	if err := db.Exec(`UPDATE orders SET customer_id = customers.id FROM customers
		WHERE orders.client_name = customers.name AND orders.customer_id IS NULL`).Error; err != nil {
		return err
	}
	if err := db.Exec(`UPDATE order_items SET product_id = products.id FROM products
		WHERE order_items.product_name = products.name AND order_items.product_id IS NULL`).Error; err != nil {
		return err
	}

	if err := seedBasePriceList(db, firstUser.ID); err != nil {
		return err
	}

	return nil
}

// seedBasePriceList creates a starter "Dubai Standard" price list covering
// the seeded product catalog the first time no price lists exist, and
// assigns it to any sales-role user who doesn't already have one.
func seedBasePriceList(db *gorm.DB, defaultOwnerID uint) error {
	var priceListCount int64
	if err := db.Model(&models.PriceList{}).Count(&priceListCount).Error; err != nil {
		return err
	}
	if priceListCount > 0 {
		return nil
	}

	ownerID := defaultOwnerID
	var manager models.User
	if err := db.Where("role = ?", models.RoleManager).Order("id asc").First(&manager).Error; err == nil {
		ownerID = manager.ID
	}

	basePrices := map[string]float64{
		"Ready Mix Concrete C30":        355,
		"Rebar 12mm":                    1040,
		"Steel Reinforcement Bars 16mm": 2750,
		"Cement Bags 50kg":              85.5,
		"Glass Curtain Wall Panels":     1200,
		"Aluminum Formwork Panels":      450,
		"Precast Concrete Blocks":       28,
		"PVC Conduit Pipes 25mm":        12,
		"Structural Steel I-Beams":      3200,
		"Waterproofing Membrane Rolls":  180,
		"Ceramic Floor Tiles 600x600":   45.5,
		"HVAC Ducting Sheets":           210,
		"Electrical Cable Trays":        95,
	}

	var products []models.Product
	if err := db.Find(&products).Error; err != nil {
		return err
	}

	priceList := models.PriceList{Name: "Dubai Standard", CreatedByID: ownerID}
	if err := db.Create(&priceList).Error; err != nil {
		return err
	}

	items := make([]models.PriceListItem, 0, len(products))
	for _, product := range products {
		price, ok := basePrices[product.Name]
		if !ok {
			continue
		}
		items = append(items, models.PriceListItem{PriceListID: priceList.ID, ProductID: product.ID, UnitPrice: price})
	}
	if len(items) > 0 {
		if err := db.Create(&items).Error; err != nil {
			return err
		}
	}

	if err := db.Model(&models.User{}).
		Where("role = ? AND price_list_id IS NULL", models.RoleSales).
		Update("price_list_id", priceList.ID).Error; err != nil {
		return err
	}

	return nil
}
