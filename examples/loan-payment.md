# Loan payment

What will a loan cost each month, and in total?

```calc
input amount = 250000 in 1000..5000000
input rate = 5.5 in 0.1..30        // % per year
input years = 25 in 1..40
r = rate / 100 / 12                  // monthly rate
n = years * 12                       // number of payments
payment = amount * r * (1 + r) ^ n / ((1 + r) ^ n - 1)
total = payment * n
interest = total - amount
```

| Loan | |
|---|---|
| Amount, \$ | :input[amount] |
| Interest, % a year | :input[rate]{widget=slider step=0.1} |
| Term, years | :input[years]{widget=slider} |
| **Monthly payment** | **\$:value[payment]{format=fixed:2}** |
| Paid in total | \$:value[total]{format=fixed:0} |
| Of which interest | \$:value[interest]{format=fixed:0} (:value[interest / amount]{format=percent:0} of the loan) |

$$ M = A\,\frac{r(1+r)^n}{(1+r)^n - 1}, \quad r = \frac{ {{rate}} }{1200}, \; n = {{n}} $$

:::details[Why a shorter term saves so much]
Interest is charged on what you still owe. Paying it back faster means less is owed for less time.
:::
