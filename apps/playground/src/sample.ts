export const SAMPLE = String.raw`# Compound interest

How much does a deposit grow? Change the numbers; everything below updates.

` + '```calc' + String.raw`
input principal = 10000 in 0..10000000
input rate = 8 in 0..30          // % per year
input years = 10 in 1..50
growth = (1 + rate / 100) ^ years
final = principal * growth
earned = final - principal
` + '```' + String.raw`

Deposit :input[principal] at :input[rate]{widget=slider step=0.5} % a year
for :input[years]{step=1} years.

After :value[years] years you have **:value[final]{format=fixed:2}**,
of which :value[earned]{format=fixed:2} is interest (:value[growth - 1]{format=percent:1} growth).

$$ P_n = P_0 \left(1 + \frac{r}{100}\right)^{n} = {{principal}} \cdot \left(1 + \frac{ {{rate}} }{100}\right)^{ {{years}} } \approx {{round(final, 2)}} $$

:::tip[How it works]
The ` + '`calc`' + String.raw` block defines inputs and formulas; readers don't see it.
` + '`:input[name]`' + String.raw` shows a control, ` + '`:value[expr]`' + String.raw` shows a result, and
` + '`{{expr}}`' + String.raw` puts a value into a formula.
:::

## A second example: splitting a trip

` + '```calc' + String.raw`
input people = 4 in 1..20
input nights = 3 in 1..30
input price = 5200 in 0..100000   // per room per night
rooms = ceil(people / 2)
total = price * nights * rooms
share = round(total / people)
` + '```' + String.raw`

| Trip | |
|---|---|
| People | :input[people]{widget=slider step=1} |
| Nights | :input[nights]{step=1} |
| Room price | :input[price] |
| Rooms (2 per room) | :value[rooms] |
| **Each pays** | **:value[share]** |

:::details[The formula]
$\text{share} = \dfrac{ {{price}} \times {{nights}} \times {{rooms}} }{ {{people}} } = {{share}}$
:::
`;
