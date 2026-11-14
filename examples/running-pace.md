# Running pace

Turn a race result into a pace, or plan a target time.

```calc
input km = 10 in 0.1..100
input hours = 0 in 0..10
input minutes = 52 in 0..59
input seconds = 30 in 0..59
time = max(hours * 3600 + minutes * 60 + seconds, 1)   // s, at least 1 so nothing divides by zero
pace = time / km                               // s per km
paceMin = floor(pace / 60)
paceSec = floor(pace % 60)
speed = km / (time / 3600)                     // km/h
marathon = 42.195 * pace / 3600                // h, at the same pace
```

Distance :input[km] km in :input[hours] h :input[minutes] min :input[seconds] s.

**Pace: :value[paceMin] min :value[paceSec] s per km**, or :value[speed]{format=fixed:1} km/h.

At this pace a marathon takes about :value[marathon]{format=fixed:2} hours.

$$ \text{pace} = \frac{t}{d} = \frac{ {{time}}\,\text{s} }{ {{km}}\,\text{km} } = {{round(pace)}}\,\text{s/km} $$
