# Split the bill

Splitting a restaurant bill, with a tip.

```calc
input bill = 120 in 0..10000
input tip = 10 in 0..30          // %
input people = 3 in 1..30
tipAmount = bill * tip / 100
total = bill + tipAmount
each = total / people
eachRounded = ceil(each)
```

The bill is \$:input[bill]. Tip :input[tip]{widget=slider step=1} %, shared by :input[people]{step=1} people.

- Tip: \$:value[tipAmount]{format=fixed:2}
- Total: \$:value[total]{format=fixed:2}
- **Each pays \$:value[each]{format=fixed:2}**, or \$:value[eachRounded] rounded up.
