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

Deposit :edit[Deposit]{input=principal}, at :slider[Rate (%/year)]{input=rate step=0.5}% per year
for :edit[Term (years)]{input=years step=1} years.

After :value[years] years you have **:value[final]{format=fixed:2}**,
of which :value[earned]{format=fixed:2} is interest (:value[growth - 1]{format=percent:1} growth).

$$ P_n = P_0 \left(1 + \frac{r}{100}\right)^{n} = {{principal}} \cdot \left(1 + \frac{ {{rate}} }{100}\right)^{ {{years}} } \approx {{round(final, 2)}} $$

:::tip[How it works]
The ` + '`calc`' + String.raw` block defines inputs and formulas; readers don't see it.
` + '`:edit{input=name}`' + String.raw` shows a control, ` + '`:value[expr]`' + String.raw` shows a result, and
` + '`{{expr}}`' + String.raw` puts a value into a formula.
:::

## A second example: splitting a trip

` + '```calc' + String.raw`
input people = 4 in 1..20
input nights = 3 in 1..30
input price = 5200 in 0..100000   // per room per night
input travel = 0 in 0..2000     // per person
rooms = ceil(people / 2)
total = price * nights * rooms + travel * people
share = round(total / people)
` + '```' + String.raw`

| Trip | |
|---|---|
| People | :slider[People]{input=people step=1} |
| Nights | :edit[Nights]{input=nights step=1} |
| Room price | :edit[Room price]{input=price} |
| Rooms (2 per room) | :value[rooms] |
| **Each pays** | **:value[share]** |

:::radio[Travel per person]{input=travel}
::option[Already there — 0]{value=0}
::option[Train — 800]{value=800}
::option[Flight — 2000]{value=2000}
:::

:::select[Room rate per night]{input=price}
::option[Hostel — 3500]{value=3500}
::option[Guesthouse — 5200]{value=5200}
::option[Hotel — 8000]{value=8000}
:::

The room-rate menu and number field stay synchronized; only listed prices are
accepted. Calc defines the default choices, not the first option in each list.

:::details[The formula]
$\text{share} = \dfrac{ {{price}} \times {{nights}} \times {{rooms}} }{ {{people}} } + {{travel}} = {{share}}$
:::
`;
