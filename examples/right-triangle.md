# Right triangle

Give the two short sides; the rest follows from Pythagoras.

```calc
input a = 3 in 0.1..1000
input b = 4 in 0.1..1000
c = sqrt(a ^ 2 + b ^ 2)
area = a * b / 2
perimeter = a + b + c
```

Sides :input[a]{widget=slider step=0.1} and :input[b]{widget=slider step=0.1}.

- Hypotenuse: **:value[c]{format=fixed:3}**
- Area: :value[area]{format=fixed:2}
- Perimeter: :value[perimeter]{format=fixed:2}

$$ c = \sqrt{a^2 + b^2} = \sqrt{ {{a}}^2 + {{b}}^2 } = \sqrt{ {{a^2 + b^2}} } \approx {{round(c, 3)}} $$

:::details[A classic]
3, 4, 5 is the smallest right triangle with whole-number sides. Try 5 and 12.
:::
