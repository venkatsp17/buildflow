package models

type Role string

const (
	RoleSales   Role = "sales"
	RoleManager Role = "manager"
)

func (r Role) IsValid() bool {
	switch r {
	case RoleSales, RoleManager:
		return true
	default:
		return false
	}
}
