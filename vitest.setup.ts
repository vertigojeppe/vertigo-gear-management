import "dotenv/config";

// Integration tests that touch the database read DATABASE_URL from .env
// (or from the CI environment). Pure unit tests do not need it.
