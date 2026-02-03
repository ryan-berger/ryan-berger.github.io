---
title: "Finding the Longest Line of Sight"
date: 2026-02-09T19:10:00-07:00
searchHidden: false
draft: false
---

One fateful day I was browsing a tech forum, [lobste.rs](https://lobste.rs), and stumbled upon a message that would captivate me for 6 months.

My good friend [Tom Buckley-Houston](https://tombh.co.uk), posted in a ["what are you working on this week" thread](https://lobste.rs/s/2ftfd1/what_are_you_doing_this_week#c_uiub1p)
that he was working on algorithmically finding the longest line of sight in the world. In other words, how far from a (likely) very tall 
point can you see another (likely) tall point?

"Well Ryan," you may be saying, "isn't this a solved problem? [It's somewhere between Russia and China](https://www.summitpost.org/phpBB3/longest-lines-of-sight-photographed-t44409-150.html)"
and I would say: "have you explored the entire earth yet?" It took a lot of very good sleuths to find the theoretical 
longest line of sight, but we haven't exhaustively proven there can't be any longer, have we?

What if, like a mathematician, we could prove by cases that we have checked every line of sight?
What if we wanted to know the longest line of sight in Seattle? What about in Utah? Wales? From Everest? 
What about if the air temperature is low? The earth is flat?  All these questions are interesting, but adjusting each 
variable may require a full recalculation for the entire world. A single one of these would take millions of years of a 
mathematician's time. How would they even gather all the data in the first place? Roam the earth? 

Thankfully, silicon manufacturers have created little "proof by case" mathematicians that are ubiquitous and 
extremely inexpensive. And thanks to the NASA, we have a detailed LiDAR map which gives us an average elevation
for every 100mx100m section of land for the entire planet. The perfect conditions for someone to take this on, and saving
me from spending billions on wandering mathematicians!

## Viewsheds

How do we prove this? We've decided to use a viewshed algorithm. 

You may feel duped that I'm now talking about viewsheds and not long lines of sight, but don't worry we'll get there.

A [viewshed](https://en.wikipedia.org/wiki/Viewshed) is a sort of top-down visibility panorama for a particular point on 
a map. It works by processing each line of sight in all 360 degrees and "coloring in" all the visible points,
after which all the visible area from the lookout will be colored in. However, we need to do this for *all* possible look-out
locations on the map which is called a "total viewshed" or TVS for short. In our case, we'll need a TVS of 
the entire world, but all current methods are woefully unequipped for this.

Singular viewshed analysis tools are not built for calculating a TVS, rather, they exist to calculate the viewshed for 
one or two prominent points (i.e. a new building), not billions!

To get a feel for what a viewshed looks like, here's a viewshed from Tom's home country of Wales that we
are now both very acquainted with:

{{< figure src="/lines/cardiff_viewshed.png" align=center >}}

All the gray portions of the map are what are visible from a look-out point from a river bed in Cardiff. 

A TVS of the same area on the other hand, looks like this:
{{< figure src="/lines/total_surfaces.png" align=center >}}

Very different! The more surface area that is visible, the whiter the heatmap, meaning you can 
see more (and potentially further).

### A Fork In The Road

Primed with this introductory knowledge, you now have two choices. The following blog post is my attempt at a non-technical
blog post about the project, but you can also choose the technical version where I get into the nitty-gritty about all
the interesting hardware and software details. Use your free will accordingly:

[Keep Going](#a-starting-point)

[A Treacherous Path](/posts/total-viewshed-algorithm)

### A Starting Point

Tom implemented a TVS algorithm from some [Spanish researchers](https://ieeexplore.ieee.org/document/6837455), and in 
July of 2025 picked it back up with some extra performance improvements and modifications. The initial test runs with 
this algorithm to find the longest line of sight on Everest took roughly 12 hours to run for a measly maximum line of 
sight of 600km. Tom theorized Everest's could be much bigger at ~800km making this approach even less feasible. Because
you are working with a square, 600km -> 800km is actually 1.7x more data, not just 1.3x. The computation time it takes is 
cubed in terms of the line of sight, meaning 600km -> 800km is actually 2.3x slower to run, taking just over a day. Ouch!

Even taking a quarter of that amount of time and doing this for the entire world is algorithmically infeasible,
unless you have many millions of dollars and years of compute to spare.

### Computers Are Faster Than You Think

After hearing Tom mention the 12-hour number, something smelled quite fishy to me. Tom swore up and down that it was
the size of the data, which he is correct; it is a huge amount.

How massive? For Everest, it is a 600km by 600km tile, the satellite data is recorded at a 100m resolution, which means that
there are 6000 by 6000 points for a given tile. For each of those 36,000,000 points, you need to check in
360 different directions, out to the maximum line of sight of 6000 points. So, for those not keeping track, we have:

$$
6000 * 6000 * 6000 * 360 \newline= 77,760,000,000,000
$$

Points to process. Yes, 77.7 TRILLION. If a wandering mathematician walked to every point on Everest's map every
second for their whole life I hope they are a vampire because it would take ~2.5 million years for them to complete 
their journey. YIKES.

However, after calculating the above number, I was even more suspicious. Even though it may not seem like it, because
it takes 10 hours and a gazillion-and-a-half gigs of RAM to open a new Chrome tab, computers are much faster than they used to be.
Consumer GPUs now have performance measured in the teraflops, and consumer multicore CPUs in the hundreds of gigaflops.
Calculating lines of sight at those speeds should reduce the problem down to minutes.

Getting that level of compute used to be (a) impossible, or (b) nation-state level. Nowadays, your Apple M-series laptop
can do this speed of computation without internal fans.

So, as the naive but hopeful software engineer I am, I set out to optimize an algorithm for the longest line of sight.


## My Algorithm

### Line of Sight Visibility

The longest line of sight is defined in terms of visibility as it is the furthest visible - and unobstructed - point from the observer.

How can we determine whether our view is obstructed between two points? Well, we can project ourselves onto the map like the
little Google Maps Street View Guy&trade; and keep track of the furthest, tallest thing we've seen. If we compare
where we are looking with the furthest, highest elevation we've seen, we can determine if there is something taller obstructing our view.

Take for example this cross-section of the Street View Guy&trade;'s line of sight when looking straight forward:

{{< figure src="/lines/visibility.png" align=center >}}

It sees a valley, which then turns into a hill, of which there is a second smaller hill behind.

Imagine we send a surveyor out along the line of sight with their [laser level](https://en.wikipedia.org/wiki/Laser_level) to determine whether they can
see the observer:
{{< figure src="/lines/visibility_surveyor.png" align=center >}}

As the surveyor walks down the valley they are able to note that they can still see the
observer since the valley has a lower elevation. Then, as our surveyor climbs up the hill to the top,
they'll be able to see the observer on the entire front face of the hill. 

Suddenly at the crest, they reach the peak for which there is not one closer or higher, and as they survey from the back side of the
hill the observer will no longer be visible. The tallest, furthest point (the first peak) is obstructing it.


### Sharing is Caring

The first thing that I noticed about the algorithm Tom implemented is that although the authors mention that it
"shares" a lot, it doesn't actually share that much data. What sort of data am I looking to share? Well, elevation data.

Tom's implementation of the researcher's algorithm caused me to re-deploy surveyors each time I do the line of sight calculation.
Each would do a single check to determine whether it is higher than the current highest seen elevation. 

{{< figure src="/lines/redeploy.png" align=center >}}

But if I already know I need to find the longest line of sight within the valley - or from any other point on the terrain -
why not send out a bunch of surveyors all at once, and make sure that they *also* record the longest line for themselves:

{{< figure src="/lines/observer_surveyor.png" align=center >}}

Here the surveyors are not only sharing whether the first observer is higher than previous highest, but they act as observers themselves.
And in fact, the first observer can head up to the front lines. Then they'll make themselves useful in determining whether
they are higher than the current highest for the second observer's line of sight.

{{< figure src="/lines/observer_surveyor_two.png" align=center >}}

Because sending out a new surveyor each time is memory intensive for a computer, we are wasting tons of memory accesses.
Not sharing memory efficiently incurs a penalty on the order of magnitude of taking a flight with multiple layovers, 
but flying back to the original airport at each stop before making the next connecting flight.

### [Get Rotated, idiot](https://www.youtube.com/watch?v=BUi4eHBGAII)

So, how do we share data? The answer is simple: we need to process points in order of the line of sight.
Our observer has a range of view left and right of only one degree, meaning we need to process
a line of sight for each degree of 360 degrees in the panorama.

We always start from the left and go to the right, but only knowing the angle causes lots of re-deploying
of surveyors. Processing all points at a 45-degree angle without ordering them properly looks like this:

{{< figure src="/lines/unrotated_order.png" align=center >}}

Yuck! Look at how little each point overlaps! Our surveyors are getting redeployed at that angle for each
blue point.

It may be counterintuitive, but this whole ordering mess can all be solved by _rotating_ the map!
Here's the map rotated 45 degrees, starting from the same corner and processing from left to right:

{{< figure src="/lines/rotated_order.png" align=center >}}

Notice that the arrows overlap quite a bit! It means we never have to re-deploy surveyors out to measure the visibility.

### I Can Be Your Angle... Or Yuor Devil

Although I want a huge amounts of sharing when it comes to the data I'm using for calculation, the _last_ thing I want
is for each surveyor to get caught up by the past one's line of sight calculations.

Keeping track of the change in elevations is kind of annoying. A surveyor depends on the one before it!
A carried dependency, yuck. Wouldn't it be nice if you could do some basic computation given the observer and
the target point and be able to free yourself of the shackles of the carried dependency?!?
High school math teachers have this one neat trick they don't want you to know: angles.

The angle between the observer and a particular point is an Opposite/Adjacent (TOA of SOHCAHTOA fame)
relationship on a right triangle:
{{< figure src="/lines/sohcahtoah.png" align=center >}}


Meaning the angle between the observer and a point is:

$$
tan(angle) = (elevation - observerHeight) / distance \newline
angle = tan^{-1}((elevation - observerHeight) / distance)
$$

Notice, that the angle is a relationship between both _how far_ a point is, and _how tall_ a point is.

This makes it perfect for our viewshed calculation. We don't need to keep track of the highest, furthest point.
Rather, we need to keep track of the highest angle we've seen. A point along our line of sight will only be visible
if its angle is higher than the highest angle we've seen. This lets us not have to worry about how far away or
how tall it is, just the angle.

### Angle Visibility

Now that we can very quickly - and in parallel - calculate the angles in our line of sight, we need to determine if a particular
point is visible. To do this in parallel we calculate the "exclusive prefix maximum" which is a list where each point gets
an item calculated from the highest of _all_ previous angles. This way, each surveyor can determine whether itself is visible to the observer.

More concretely, here's our angles between our surveyors (excuse my straight lines):

{{< figure src="/lines/angles.png" align=center >}}

Calculating the prefix maximum for the angles would leave us with:

{{< figure src="/lines/angles_prefix_max.png" align=center >}}

Notice the last two surveyor's angles both have a prefix maximum of 42°. The 42° angle gets copied over for the
last surveyor because 30° isn't higher than 42°, and the prefix maximum is the highest of _all_ previous angles.

Only surveyors whose angle is greater than their prefix maximum are visible, and now they can independently 
determine if they are visible to the observer!

### Refraction and Curvature

Despite me and my coauthor's many protestations, the earth is unfortunately not flat. It is an oblate spheroid, and the sky
is in fact blue. No, not rhetorically, the sky is blue due to light refraction within our atmosphere which, turns out, 
affects what is visible to us. Light quite literally curves through air to let photons hit your eyeballs.

This is why for example, you can see a mirage off in the distance. What creates these conditions? Generally a temperature
difference between two layers of air, which happens to generally correlate to altitude. 

When conditions are right, photons are able to overcome earth's curvature and let you see further.

How does our tool account for this? There is a refraction equation in the [GIS literature](https://pro.arcgis.com/en/pro-app/3.4/tool-reference/3d-analyst/how-line-of-sight-works.htm)
that will let us adjust the elevations of the points along our line of sight.

{{< figure src="/lines/refraction.png" align=center >}}

This plays along perfectly with our angle calculation.
 
### Putting It Together

To pull this all together to get something capable of finding the longest line of sight for the world we:
- Calculate the worst case line of sight for each region of the earth, [chunking it up into smaller pieces.](https://tombh.co.uk/packing-world-lines-of-sight)
- For each chunk, we calculate every line of sight for every point on the map, rotating the map 360 degrees to get a full panorama.
- Keep track of the furthest visible point for all points on the map, for all degrees, and for every chunk. Then we'll combine them to get the world's longest line of sight.

And how fast is it? _Screaming fast_.

Running it on my old i9900k CPU with 128GB of DDR4 RAM results in a drastic speedup. It went from Everest taking
12 hours on a GPU with Tom's original implementation, to _**57 minutes**_  on my CPU - something much less powerful. WOW.

When I run it on a top of the line machines, I can cut that down to _**4 and a half minutes flat**_. A 160x speed up.
Bonkers.

Running it for all 2500 tiles took about 18 hours with 5 very large machines that Tom and I rented.

### Where is it?

Would you like to know what the longest line of sight is? Well, we have the longest line of sight leaderboard you can
check out at https://alltheviews.world! We've worked quite hard to document our journey and build a very cool
tool to show off the beautiful earth and all its long lines of sight, enjoy!

## Acknowledgements

I'd like to acknowledge first and foremost, Tom Buckley-Houston for his willingness to collaborate and
steadfastness in keeping the project moving and keeping bugs away even during the hardest parts of the project.
Please go check out his blogpost [here](https://tombh.co.uk/longest-line-of-sight)

I'd also like to acknowledge my amazing family and friends who have listened to my crazed ramblings about rotations,
lines of sight, and each new optimization or timing I discovered throughout the process. Thanks lots!
