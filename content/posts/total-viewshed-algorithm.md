---
title: "Finding The Longest Line of Sight With CacheTVS"
date: 2026-02-01T20:10:00-07:00
searchHidden: true
draft: true
---

_Welcome all readers from the finding the longest line of sight post_

The past 6 months of my almost every moment of my free time has been spent developing an algorithm with my friend 
Tom Buckley-Houston to exhaustively prove that we've found the longest line of sight. We both felt it was very 
doable algorithmically, but current options looked extremely computationally intensive.

Since the inception of the project, through hard work and collaboration we have been able to speed up the calculations
by hundreds of times, and make it entirely feasible on top-of-the-line CPUs such as the AMD Turin. 
Please enjoy the deep dive, and make sure to check out [https://alltheviews.world](https://alltheviews.world) for the final product!

## Viewshed Algorithms

A [viewshed](https://en.wikipedia.org/wiki/Viewshed) is all the area visible from a particular location on the map:

{{< figure src="/lines/cardiff_viewshed.webp" align=center >}}

It also happens to hold the longest line of sight, since it is the furthest
visible point from the observer.

Traditional viewshed algorithms take Digital Elevation Mappings (DEMs) and calculate the angles pair-wise for all points
and then determine whether there are obstructions. This approach works well for a single viewshed, however, scaling to
more than one runs head-first into cache issues. 

You could imagine if you naively apply this pair-wise computation you end up re-fetching and re-calculating quite a lot.
Tools like ArcGIS do single viewshed calculations on the order of minutes, which works just fine for a single viewshed
but makes every point on the planet algorithmically infeasible, so a new solution was needed. We needed a "total viewshed",
not just a single viewshed.

Enter, the total viewshed algorithm.

### Total Viewsheds

Some literature exists for calculating total viewsheds for larger maps, notably, there are some prolific
authors who have published many papers INSERT SPANISH RESEARCHERS. My friend Tom read (INSERT 2018 PAPER) back in 
2020 while researching how to find the longest line of sight, which had been a dream of his.

In the paper, they lay out a solution that attempts to share a lot of the work that is done during a single viewshed calculation.
This approach made use of Linear Algebra to find the closest points to a normal vector (that they call the sector)
so they can sort them and process each line of sight in order by distance.

(INSERT GRAPHIC ABOUT SECTOR DISTANCES)

They stuff the offsets into a linked list which they ship off to a GPU where they walk it in parallel
calculating lines of sight.

Very quickly, Tom noticed that the linked list is not a good idea. In fact, these distances from a sector are always
going to have some upper bound, so we can at least pre-allocate a vector of that size. Tom called these "deltas".
Each angle had its own deltas (since the normal vector changes as you rotate the unit vector in space) so that
each point inside the DEM could then run the usual viewshed algorithm on it. This is where it was left off
until last year when Tom ported it to Rust.

## Enter The Rabbithole

After rubbing some braincells together on the problem and re-implementing the algorithm myself, I noticed a complete lack
of cache locality. The total viewshed algorithms may not have to recompute the offsets for each point, but it
is effectively a single viewshed algorithm applied for every point, not exactly good for having to compute every viewshed. 

Each of the offsets or "deltas" used are not processed in any particular order, meaning going from (0, 0) to (0, 1)
on the coordinate plane could mean that you are accessing completely different elevations when walking at a diagonal. 
Effectively benchmarking your processors prefetcher with the number of cache misses you'll incur.

How bad are these cache misses? Well, the elevation data we have is at a resolution of 100m so for 
Mount Everest's [600km x 600km worst case line of sight](TOMLINK) we are talking 36 million elevations. 
Those elevations are stored as i16s totaling 72MBs. Much bigger than what L3 can fit.

To solve this you could order access along the line of sight so that the next line of sight calculation starts
at the result of adding the "delta" to where you are currently processing. This would definitely solve
some of your cache issues, however, some astute readers may realize that a cache line is 64 bytes, meaning 
accessing at random offsets means you over-fetch by a factor of 4. 75% of your cache hits are completely wasted, unless
you can hit 4 times your line of sight in a single cache line, a tall order.

So, how do we solve both processing the line of sight in an orderly and cache efficient manner? Well, what if I told
you that we could take all of those cache misses up front

Enter, CacheTVS, a total viewshed algorithm that trades a very small amount of accuracy for a huge amount
of cache locality.

#### Math Nerd (Arc)tangent:
We don't actually need to carry out \\(tan^{-1}\\) because it is continuous and monotonically
increasing on \\((-\infty, \infty)\\). i.e. \\( tan^{-1}(x_1) > tan^{-1}(x_2) \implies x_1 > x_2 \\).