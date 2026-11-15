# A condition with room to grow

```calc
input rate = 8 in 0..20
input years = 10 in 1..50
estimate = 72 / max(rate, 1)
```

Rate: :input[rate]. Years: :input[years].

The outer six-colon fence leaves room for adding inner levels. Combine the
conditions with `and` instead of nesting two `when` blocks.

::::::when[rate > 0 and years > 5]
:::note[Rule of 72]
At this rate, doubling takes roughly :value[estimate]{format=fixed:1} years.
:::
::::::
