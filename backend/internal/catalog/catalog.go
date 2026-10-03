package catalog

import (
	"errors"
	"math"
)

var (
	ErrEmptyCart       = errors.New("cart must contain at least one item")
	ErrInvalidQuantity = errors.New("item quantity must be between one and five")
	ErrUnknownProduct  = errors.New("cart contains an unknown product")
	ErrDuplicateItem   = errors.New("cart contains a duplicate product")
	ErrAmountOverflow  = errors.New("cart total exceeds the supported range")
)

type Product struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Category    string `json:"category"`
	Description string `json:"description"`
	PriceAtomic string `json:"priceAtomic"`
	Tone        string `json:"tone"`
	Edition     string `json:"edition"`
	price       uint64
}

type Item struct {
	ProductID string `json:"productId"`
	Quantity  uint64 `json:"quantity"`
}

type Line struct {
	Product     Product `json:"product"`
	Quantity    uint64  `json:"quantity"`
	TotalAtomic string  `json:"totalAtomic"`
}

var products = []Product{
	{ID: "orbit-lamp", Name: "Orbit Lamp", Category: "Light", Description: "A quiet pool of light for late work and slow mornings.", PriceAtomic: "38500000", Tone: "ivory", Edition: "01 / 08", price: 38_500_000},
	{ID: "field-notebook", Name: "Field Notebook", Category: "Paper", Description: "Thread-bound pages with a lay-flat spine and tactile stock.", PriceAtomic: "12000000", Tone: "sand", Edition: "02 / 08", price: 12_000_000},
	{ID: "arc-speaker", Name: "Arc Speaker", Category: "Sound", Description: "A compact room speaker tuned for warm, close listening.", PriceAtomic: "64000000", Tone: "graphite", Edition: "03 / 08", price: 64_000_000},
	{ID: "mineral-cup", Name: "Mineral Cup", Category: "Table", Description: "Hand-finished stoneware with a soft mineral glaze.", PriceAtomic: "18500000", Tone: "clay", Edition: "04 / 08", price: 18_500_000},
	{ID: "pebble-vase", Name: "Pebble Vase", Category: "Objects", Description: "A softly asymmetric vessel shaped and finished by hand.", PriceAtomic: "28000000", Tone: "sage", Edition: "05 / 08", price: 28_000_000},
	{ID: "linen-throw", Name: "Linen Throw", Category: "Textile", Description: "Heavy washed linen with a relaxed weave and hand-tied fringe.", PriceAtomic: "52000000", Tone: "olive", Edition: "06 / 08", price: 52_000_000},
	{ID: "stone-tray", Name: "Stone Tray", Category: "Table", Description: "Honed natural stone for the small objects kept close.", PriceAtomic: "32000000", Tone: "chalk", Edition: "07 / 08", price: 32_000_000},
	{ID: "cedar-incense", Name: "Cedar Incense Rest", Category: "Ritual", Description: "Dark cedar and aged brass, cut as one quiet architectural line.", PriceAtomic: "16500000", Tone: "umber", Edition: "08 / 08", price: 16_500_000},
}

func Products() []Product {
	result := make([]Product, len(products))
	copy(result, products)
	return result
}

func Calculate(items []Item) ([]Line, uint64, error) {
	if len(items) == 0 || len(items) > len(products) {
		return nil, 0, ErrEmptyCart
	}
	byID := make(map[string]Product, len(products))
	for _, product := range products {
		byID[product.ID] = product
	}
	seen := make(map[string]struct{}, len(items))
	lines := make([]Line, 0, len(items))
	var total uint64
	for _, item := range items {
		if item.Quantity < 1 || item.Quantity > 5 {
			return nil, 0, ErrInvalidQuantity
		}
		product, ok := byID[item.ProductID]
		if !ok {
			return nil, 0, ErrUnknownProduct
		}
		if _, duplicate := seen[item.ProductID]; duplicate {
			return nil, 0, ErrDuplicateItem
		}
		seen[item.ProductID] = struct{}{}
		if product.price > math.MaxUint64/item.Quantity {
			return nil, 0, ErrAmountOverflow
		}
		lineTotal := product.price * item.Quantity
		if total > math.MaxUint64-lineTotal {
			return nil, 0, ErrAmountOverflow
		}
		total += lineTotal
		lines = append(lines, Line{Product: product, Quantity: item.Quantity, TotalAtomic: uintString(lineTotal)})
	}
	return lines, total, nil
}

func uintString(value uint64) string {
	if value == 0 {
		return "0"
	}
	var buffer [20]byte
	index := len(buffer)
	for value > 0 {
		index--
		buffer[index] = byte('0' + value%10)
		value /= 10
	}
	return string(buffer[index:])
}
