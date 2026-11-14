# Compound interest

How much does a deposit grow? Change the numbers; everything below updates.

```calc
input principal = 10000 in 0..10000000
input rate = 8 in 0..30          // % per year
input years = 10 in 1..50
growth = (1 + rate / 100) ^ years
final = principal * growth
earned = final - principal
```

Deposit \$:input[principal] at :input[rate]{widget=slider step=0.1} % a year for :input[years] years.

After :value[years] years you have **\$:value[final]{format=fixed:2}**, of which \$:value[earned]{format=fixed:2} is interest (:value[growth - 1]{format=percent:1} growth).

$$
\begin{aligned}
P_n &= P_0 \left(1 + \frac{r}{100}\right)^{n} \\
    &= {{principal}} \cdot \left(1 + \frac{ {{rate}} }{100}\right)^{ {{years}} } \\
    &\approx {{round(final, 2)}}
\end{aligned}
$$

:::tip[Try it]
Double the years and watch the interest more than double. That is compounding.
:::
