# Pancakes for any number of people

The recipe is written for 4. Choose how many you are cooking for.

```calc
input people = 4 in 1..24
k = people / 4
flour = 200 * k        // g
milk = 300 * k         // ml
eggs = ceil(2 * k)
sugar = 25 * k         // g
butter = 30 * k        // g
```

Servings: :input[people]{widget=slider}

| Ingredient | Amount |
|---|---|
| Flour | :value[flour]{format=int} g |
| Milk | :value[milk]{format=int} ml |
| Eggs | :value[eggs] |
| Sugar | :value[sugar]{format=int} g |
| Butter, melted | :value[butter]{format=int} g |

1. Whisk the flour, sugar and a pinch of salt.
2. Add the eggs and half of the milk; whisk until smooth, then add the rest.
3. Stir in the butter, rest 10 minutes, and fry in a hot pan.

Eggs are rounded up, so the batter may be a little richer for odd numbers.
