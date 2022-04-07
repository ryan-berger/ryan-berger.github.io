---
title: "Go and Generics (pt 1)"
date: 2022-01-08T17:34:30-07:00
searchHidden: false
draft: true
---

A few days ago I was asked to talk about Go generics at the Utah Go meetup which you can see here(insert link). 

After the talk, I realized that I didn't explain things as well as I could have, nor was I able to go as deep as I would have liked. This article will be a part of a multiple part series where I explore the code generation for generics, discuss design patterns, and try to give a broad overview of generics.
The goal is to go deep enough to understand the features and performance implications, but not so deep that I'm building up to some conclusion. This is meant to be a good and exhaustive overview.

With that out of the way, let's get started.

### What are generics anyway?

As programmers, we typically like the idea of DRY, or Don't Repeat Yourself. We attempt to abstract our logic in such away that it is extensible and reusable.

Functions and methods are the way that we typically do this. We have a function that takes a few arguments that can handle a number of cases. For example, we may want to write a `min` method instead of doing a conditional check each time:

```go

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}


func main() {
	a, b, c, d, e := 1, 2, 3, 4, 5
	if a < b  {
		// do some logic
	}
	if a < c {
		// do some logic
	}
	
	// much simpler to call a function!
	resultAB := min(a, b)
	resultAC := min(a, c)
}

```



