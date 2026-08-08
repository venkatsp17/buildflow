package models

import "time"

type OrderStatus string

const (
	OrderStatusPending    OrderStatus = "pending"
	OrderStatusInProgress OrderStatus = "in_progress"
	OrderStatusDispatched OrderStatus = "dispatched"
	OrderStatusDone       OrderStatus = "done"
	OrderStatusCancelled  OrderStatus = "cancelled"
)

func (s OrderStatus) IsValid() bool {
	switch s {
	case OrderStatusPending, OrderStatusInProgress, OrderStatusDispatched, OrderStatusDone, OrderStatusCancelled:
		return true
	default:
		return false
	}
}

type OrderUrgency string

const (
	OrderUrgencyLow    OrderUrgency = "low"
	OrderUrgencyMedium OrderUrgency = "medium"
	OrderUrgencyHigh   OrderUrgency = "high"
	OrderUrgencyUrgent OrderUrgency = "urgent"
)

func (u OrderUrgency) IsValid() bool {
	switch u {
	case OrderUrgencyLow, OrderUrgencyMedium, OrderUrgencyHigh, OrderUrgencyUrgent:
		return true
	default:
		return false
	}
}

type Order struct {
	ID            uint         `gorm:"primaryKey" json:"id"`
	TicketNumber  string       `gorm:"uniqueIndex;not null" json:"ticketNumber"`
	CustomerID    *uint        `json:"customerId,omitempty"`
	Customer      *Customer    `json:"customer,omitempty"`
	ClientName    string       `gorm:"not null" json:"clientName"`
	City          string       `gorm:"not null" json:"city"`
	Address       string       `json:"address"`
	Latitude      *float64     `json:"latitude,omitempty"`
	Longitude     *float64     `json:"longitude,omitempty"`
	PriceListName string       `gorm:"not null" json:"priceListName"`
	Status        OrderStatus  `gorm:"not null" json:"status"`
	Urgency       OrderUrgency `gorm:"not null" json:"urgency"`
	Value         float64      `gorm:"not null" json:"value"`
	Currency      string       `gorm:"not null" json:"currency"`
	DueDate       time.Time    `json:"dueDate"`
	CreatedByID   uint         `gorm:"not null;index" json:"createdById"`
	CreatedBy     *User        `json:"createdBy,omitempty"`
	AssigneeID    *uint        `json:"assigneeId,omitempty"`
	Assignee      *User        `json:"assignee,omitempty"`
	Items         []OrderItem  `json:"items"`
	CreatedAt     time.Time    `json:"createdAt"`
	UpdatedAt     time.Time    `json:"updatedAt"`
}

type OrderItem struct {
	ID          uint     `gorm:"primaryKey" json:"id"`
	OrderID     uint     `gorm:"not null;index" json:"orderId"`
	ProductID   *uint    `json:"productId,omitempty"`
	Product     *Product `json:"product,omitempty"`
	ProductName string   `gorm:"not null" json:"productName"`
	Description string   `json:"description"`
	Quantity    int      `gorm:"not null" json:"quantity"`
	Unit        string   `gorm:"not null" json:"unit"`
	UnitPrice   float64  `gorm:"not null;default:0" json:"unitPrice"`
}
