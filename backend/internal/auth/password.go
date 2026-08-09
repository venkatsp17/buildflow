package auth

import (
	"crypto/rand"

	"golang.org/x/crypto/bcrypt"
)

func HashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

func CheckPassword(hash, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

// passwordChars avoids visually ambiguous characters (0/O, 1/l/I) since a
// generated password is meant to be read off a screen and retyped once.
const passwordChars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"

// GenerateRandomPassword produces a temporary password for a manager-created
// account — the user resets it on first login (see MustResetPassword).
func GenerateRandomPassword() (string, error) {
	const length = 12
	buf := make([]byte, length)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	out := make([]byte, length)
	for i, b := range buf {
		out[i] = passwordChars[int(b)%len(passwordChars)]
	}
	return string(out), nil
}
