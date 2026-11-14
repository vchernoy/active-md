# Dropping a stone

How long does a stone take to fall, and how fast does it land? (No air resistance.)

```calc
input h = 20 in 1..1000      // m
input g = 9.81 in 1..30      // m/s², 9.81 on Earth, 1.62 on the Moon
t = sqrt(2 * h / g)          // s
v = g * t                    // m/s
kmh = v * 3.6
```

Height :input[h]{widget=slider} m, gravity :input[g] m/s².

The stone falls for **:value[t]{format=fixed:2} s** and hits the ground at :value[v]{format=fixed:1} m/s (:value[kmh]{format=int} km/h).

$$ h = \frac{g t^2}{2} \;\Rightarrow\; t = \sqrt{\frac{2h}{g}} = \sqrt{\frac{2 \cdot {{h}}}{ {{g}} }} \approx {{round(t, 2)}}\,\text{s} $$

$$ v = g t \approx {{round(v, 1)}}\,\text{m/s} $$

:::tip[Try the Moon]
Set gravity to 1.62. The fall takes about 2.5 times longer.
:::
