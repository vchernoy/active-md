# What an appliance costs to run

What does an appliance cost to run?

```calc
input watts = 2000 in 1..10000
input hours = 1.5 in 0..24         // per day
input price = 0.30 in 0..2         // $ per kWh
kwhDay = watts * hours / 1000
perMonth = kwhDay * 30 * price
perYear = kwhDay * 365 * price
```

A :input[watts] W appliance, used :input[hours] hours a day, at \$:input[price] per kWh.

| | Energy | Cost |
|---|---|---|
| Per day | :value[kwhDay]{format=fixed:2} kWh | \$:value[kwhDay * price]{format=fixed:2} |
| Per month | :value[kwhDay * 30]{format=fixed:1} kWh | \$:value[perMonth]{format=fixed:2} |
| Per year | :value[kwhDay * 365]{format=int} kWh | **\$:value[perYear]{format=fixed:0}** |

Typical power: kettle 2000 W, fridge about 150 W, laptop 50 W, LED bulb 8 W.
