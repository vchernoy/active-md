# Compound interest

How much does a deposit grow? Change the numbers; everything below updates.

```calc
input principal = 10000 in 0..10000000
input rate = 8 in 0..30          // % per year
input years = 10 in 1..50
growth = (1 + rate / 100) ^ years
final = principal * growth
earned = final - principal
doubling = if(rate > 0, log(2) / log(1 + rate/100), 0)
rule72 = if(rate > 0, 72 / rate, 0)
```

Deposit \$:edit{input=principal} at :slider[Annual interest rate]{input=rate step=0.1} % a year for :edit[Years]{input=years step=1} years.

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


:::when[rate > 0]
The exact doubling time is **:value[doubling]{format=fixed:2} years**
(`log(2) / log(1 + rate/100)`), compared with :value[rule72]{format=fixed:2}
years from the Rule of 72. The Rule of 72 is an approximation.
:::

:::when[rate == 0]
At zero interest the deposit does not double.
:::
