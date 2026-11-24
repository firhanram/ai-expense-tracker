# Money is an integer count of whole Rupiah

Amounts are stored as `INTEGER` Rupiah with no minor unit and no currency column. `15000` means Rp15.000.

The Rupiah has no conventionally used sub-unit, so exponent-2 minor units would make every stored value mean one hundredth of what a reader assumes — `15000` reading as Rp150,00. Whole-Rupiah integers keep every Report sum exact, and formatting is `Intl.NumberFormat('id-ID')` rather than hand-rolled separators.

## Consequences

- Multi-currency is not supported and would require a migration, since there is no `currency` column to key on. Accepted: this app tracks spending in one country.
- Fractional amounts cannot be recorded. If a foreign-currency purchase is ever entered, the user converts it first; the conversion rate is not stored.

## Considered Options

- **Exponent-2 minor units** (Stripe convention). Rejected: correct for currencies with cents, actively misleading for IDR.
- **`NUMERIC(14,2)`.** Rejected: admits fractions nobody uses and makes exact summation the database's job.
