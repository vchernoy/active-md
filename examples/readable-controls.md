# Readable controls

These additive control names are available in current source and are unreleased.

```calc
input principal = 100 in 0..10000
input rate = 5 in 0..100
final = principal * (1 + rate / 100)
```

Start with :edit{input=principal}, at :slider[Annual interest rate]{input=rate step=0.5}% a year.
The final amount is **:value[final]{format=fixed:2}**.

You can also place controls on their own line. Brackets name the control for
assistive technology; authors supply visible wording as ordinary prose.

Initial investment:

::edit[Initial investment]{input=principal}

The existing spelling still works and stays synchronized: :input[principal].
