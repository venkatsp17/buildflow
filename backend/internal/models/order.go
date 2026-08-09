package models

import "time"

type OrderStatus string

const (
	OrderStatusPending    OrderStatus = "pending"
	OrderStatusApproved   OrderStatus = "approved"
	OrderStatusRejected   OrderStatus = "rejected"
	OrderStatusInProgress OrderStatus = "in_progress"
	OrderStatusDispatched OrderStatus = "dispatched"
	OrderStatusDelivered  OrderStatus = "delivered"
	OrderStatusCancelled  OrderStatus = "cancelled"
)

func (s OrderStatus) IsValid() bool {
	switch s {
	case OrderStatusPending, OrderStatusApproved, OrderStatusRejected, OrderStatusInProgress, OrderStatusDispatched, OrderStatusDelivered, OrderStatusCancelled:
		return true
	default:
		return false
	}
}

// orderStatusTransitions enumerates the only status changes UpdateStatus
// will accept, so the API can't be used to skip steps (e.g. pending
// straight to dispatched) or resurrect a terminal order.
var orderStatusTransitions = map[OrderStatus][]OrderStatus{
	OrderStatusPending:    {OrderStatusApproved, OrderStatusRejected},
	OrderStatusApproved:   {OrderStatusInProgress, OrderStatusCancelled},
	OrderStatusInProgress: {OrderStatusDispatched, OrderStatusCancelled},
	OrderStatusDispatched: {OrderStatusDelivered},
}

func (s OrderStatus) CanTransitionTo(target OrderStatus) bool {
	for _, allowed := range orderStatusTransitions[s] {
		if allowed == target {
			return true
		}
	}
	return false
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
	ID              uint         `gorm:"primaryKey" json:"id"`
	TicketNumber    string       `gorm:"uniqueIndex;not null" json:"ticketNumber"`
	CustomerID      *uint        `json:"customerId,omitempty"`
	Customer        *Customer    `json:"customer,omitempty"`
	ClientName      string       `gorm:"not null" json:"clientName"`
	City            string       `gorm:"not null" json:"city"`
	Address         string       `json:"address"`
	Latitude        *float64     `json:"latitude,omitempty"`
	Longitude       *float64     `json:"longitude,omitempty"`
	PriceListName   string       `gorm:"not null" json:"priceListName"`
	Status          OrderStatus  `gorm:"not null" json:"status"`
	RejectionReason string       `json:"rejectionReason,omitempty"`
	Urgency         OrderUrgency `gorm:"not null" json:"urgency"`
	Value           float64      `gorm:"not null" json:"value"`
	Currency        string       `gorm:"not null" json:"currency"`
	DueDate         time.Time    `json:"dueDate"`
	CreatedByID     uint         `gorm:"not null;index" json:"createdById"`
	CreatedBy       *User        `json:"createdBy,omitempty"`
	Items           []OrderItem  `json:"items"`
	CreatedAt       time.Time    `json:"createdAt"`
	UpdatedAt       time.Time    `json:"updatedAt"`
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
