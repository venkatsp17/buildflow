package handlers

import (
	"encoding/json"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

type GeocodeHandler struct {
	Client *http.Client
}

func NewGeocodeHandler() *GeocodeHandler {
	return &GeocodeHandler{Client: &http.Client{Timeout: 5 * time.Second}}
}

type nominatimResult struct {
	DisplayName string `json:"display_name"`
	Lat         string `json:"lat"`
	Lon         string `json:"lon"`
}

type GeocodeResult struct {
	DisplayName string  `json:"displayName"`
	Latitude    float64 `json:"latitude"`
	Longitude   float64 `json:"longitude"`
}

// Search proxies address lookups to OpenStreetMap's Nominatim search API.
// This is proxied server-side (rather than called directly from the app)
// because Nominatim's usage policy requires a descriptive User-Agent header,
// which browsers refuse to let client-side JS set.
func (h *GeocodeHandler) Search(c *gin.Context) {
	query := c.Query("q")
	if query == "" {
		c.JSON(http.StatusOK, gin.H{"results": []GeocodeResult{}})
		return
	}

	reqURL := "https://nominatim.openstreetmap.org/search?format=json&limit=5&accept-language=en&q=" + url.QueryEscape(query)
	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodGet, reqURL, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to build geocode request"})
		return
	}
	req.Header.Set("User-Agent", "BuildFlow/1.0 (order delivery address lookup)")

	resp, err := h.Client.Do(req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "failed to reach geocoding service"})
		return
	}
	defer resp.Body.Close()

	var raw []nominatimResult
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "failed to parse geocoding response"})
		return
	}

	results := make([]GeocodeResult, 0, len(raw))
	for _, r := range raw {
		lat, latErr := strconv.ParseFloat(r.Lat, 64)
		lon, lonErr := strconv.ParseFloat(r.Lon, 64)
		if latErr != nil || lonErr != nil {
			continue
		}
		results = append(results, GeocodeResult{DisplayName: r.DisplayName, Latitude: lat, Longitude: lon})
	}

	c.JSON(http.StatusOK, gin.H{"results": results})
}
