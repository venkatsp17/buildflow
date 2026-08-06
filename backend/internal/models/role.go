package models

type Role string

const (
	RoleSales         Role = "sales"
	RoleManufacturing Role = "manufacturing"
	RoleManager       Role = "manager"
)

func (r Role) IsValid() bool {
	switch r {
	case RoleSales, RoleManufacturing, RoleManager:
		return true
	default:
		return false
	}
}
