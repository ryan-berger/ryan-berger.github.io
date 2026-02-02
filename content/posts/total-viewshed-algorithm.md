---
title: "A Total Viewshed Algorithm to Find the Longest Line of Sight"
date: 2026-02-01T20:10:00-07:00
searchHidden: true
draft: true
---

> _Welcome all readers from the [non-technical lines of sight post](../lines-of-sight)_

The past 6 months of almost every moment of my free time has been spent developing an algorithm with my friend 
[Tom Buckley-Houston](https://tombh.co.uk) to exhaustively prove that we've found the longest line of sight in the world. 
We both felt it was very doable algorithmically, but current options looked extremely computationally intensive.

Since the inception of the project, through hard work and collaboration, we have been able to speed up the calculations
by hundreds of times, and make it entirely feasible on top-of-the-line CPUs such as the AMD Turin. 
Please enjoy the deep dive, and make sure to check out [Tom's sister-blogpost](https://tombh.co.uk/longest-line-of-sight) 
and [https://alltheviews.world](https://alltheviews.world) for the final product!

## The Total Viewshed Algorithm

A [viewshed](https://en.wikipedia.org/wiki/Viewshed) is all the area visible from a particular location on the map:

{{< figure src="/lines/cardiff_viewshed.webp" align=center >}}

It also happens to hold the longest line of sight, since it is the furthest
visible point from the observer.

Traditional viewshed algorithms take Digital Elevation Mappings (DEMs) and calculate the angles pair-wise for all points
and then determine whether there are obstructions. This approach works well for a single viewshed, however, scaling to
more than one runs head-first into cache issues. 

You could imagine if you naively apply this pair-wise computation you end up re-fetching and re-calculating quite a lot.
Tools like [ArcGIS](http://pro.arcgis.com/en/pro-app/tool-reference/3d-analyst/viewshed.htm) do single viewshed calculations on the order of minutes, which works just fine for a single viewshed
but makes every point on the planet algorithmically infeasible, so a new solution was needed. We needed a "total viewshed" algorithm,
not just a single viewshed.

Enter, the total viewshed algorithm.

### Line of Sight Visibility

At the foundation of the total (or single) viewshed algorithm lies the humble line of sight visibility calculation.
The line of sight visibility is the measure of visibility for some slice of the viewshed, say one
degree, which accumulated makes up a full viewshed.

Line of sight visibility calculations are entirely boolean (is the point visible to the observer or not) and are entirely
two-dimensional. To make this three-dimensional slice of space two-dimensional, we use an azimuthal projection to 
project our observer into a two-dimensional space.

{{< figure src="/lines-technical/observer.png" align=center caption="Yes, 'azimuthal projection' is just a fancy way of describing the Google Map Guy&trade;'s POV">}}

The elevations "in front of" the observer on the y-axis, distance on the x. The line of sight may lie between 
two elevations so an interpolated value is chosen and a "band" of sight is also chosen, meaning the observer sees
exactly one point at a time.

{{< figure src="/lines-technical/observer_angle.png" align=center >}}

The angle of elevation between two points must also take into account the curvature of the earth,
along with the refraction of light. The equation for adjusting the elevation for both is given by 
the following [equation](https://pro.arcgis.com/en/pro-app/3.4/tool-reference/3d-analyst/how-line-of-sight-works.htm):

$$
E^\prime = E + (D^2(R - 1) / d_{earth}); \newline
$$

Where \\(E^\prime\\) is the adjusted elevation, \\(D\\) is the distance to the point, \\(R\\) is a refraction coefficient
which has been calculated to be \\(\approx.13\\), and \\(d_{earth}\\) is the diameter of the earth in kilometers.

The angle of elevation, \\(\theta\\), between a point along the line of sight forms a right triangle. Since adjusted  elevation is on 
the opposite side of the triangle, while the distance to the point is the adjacent side, \\(tan\\) will be our friend: 
$$
tan(\theta) = (E^\prime - h_{pov}) / D \newline
\theta = tan^{-1}((E^\prime - h_{pov}) / D)
$$

Where \\(h_{pov}\\) is the height of the observer.

> _**Math Nerd (arc)Tangent**:_
> 
> For computational purposes we won't actually carry out \\(tan^{-1}\\). We can get away with this because
> it is continuous and monotonically increasing on \\((-\infty, \infty)\\). This means
> \\( tan^{-1}(x_1) > tan^{-1}(x_2) \iff x_1 > x_2 \\) so the extra computation doesn't give us anything extra.


Once the elevations are laid out, we can determine visibility for each point along the line of sight.
A point is visible to the observer if the angle of elevation between the observer and the point is greater than all
the angles of previous points. The angle between the point of view and itself \\(-\infty\\) since there is
"no angle" and we want all angles to be greater than it.

{{< figure src="/lines-technical/prefix_angles.png" align=center >}}


Rotating this line of sight calculation around for all the terrain within the worst case line of sight for a given point 
will give you 360 different bitmaps of which points are visible. You can use those to construct a viewshed. Tada!

### Total Viewsheds

Now that we have line of sight visibility down, we can move on to the meat and potatoes, the total viewshed.

There isn't a ton of literature existing for calculating total viewsheds for large maps. However, there are a few
prolific authors in the total viewshed space who have published many papers. Namely, Tabik et al. My friend Tom
read their initial [total viewshed paper](https://ieeexplore.ieee.org/document/6837455) back in 2017 while researching 
how to find the longest line of sight, which had been a dream of his.

In the paper, they lay out a solution that attempts to parallelize a single viewshed calculation to calculate a total viewshed.
Their approach makes use of Linear Algebra to find the closest points to a normal vector (that they call the sector)
so they can determine which points to sample along the line of sight visibility calculation. In the paper they call
this "sector ordering".

{{< figure src="/lines-technical/sector_distances.png" align=center >}}

Sector distances are not necessarily uniform from point to point (even potentially zig-zagging) along the line 
of sight so they must also be kept track of.

{{< figure src="/lines-technical/zigzag.png" align=center caption="This line of sight zigzags">}}

They construct the line of sight projection using a linked list container like so:

```c
struct node {
    node* prev; // previous elevation in line of sight
    node* next; // next elevation in line of sight
    int16* data; // elevation data
    float distance; // distance from pov
}
```

The linked list elevation data isn't a copy of the elevation data, it is a pointer to it. 
This then gets shipped off to a GPU for visibility calculation. The linked list and sector distances get reconstructed
for every line of sight for every point and angle duplicating a ton of work.

Very quickly Tom found that the linked list is Not A Good Idea&trade;. In fact, the maximum line of sight is always
going to have some upper bound, so we can pre-allocate an array of that size. Rather than pointers, Tom calculated
position-independent offsets into the DEM, which he called "deltas". 

Tom also was able to make a parallel array for the sector distance. This way you add your delta to get the elevation,
you use the distance from the sector distance array, and then you are able to calculate the angle to the point along the
line of sight.

Those offsets stay the same for every angle, so Tom only ever had to calculate them once rather for each point like the 
other paper.

{{< figure src="/lines-technical/delta.png" align=center caption="Deltas are really just vectors you can add to get where you're going">}}

With deltas, you take your point of view's index, add the delta, and it gives you the index into the DEM of your
next point along your line of sight. Do this for every point for every angle and you have a total viewshed. No linked 
list or pointer indirection involved. 

Tom left his improvements on the back burner for 8 years until July 2025 when he started porting it to Rust. 

Enter, me.

### Crazy Initial Estimates

Tom's initial runs showed that running all of Everest took about 12 hours at a 600km worst case
line of sight. All our tests determined this was a good estimate, and it was very unlikely that there is
actually a line of sight longer than 600km due to earth curvature and obstructions. Our first test runs didn't show any
lines of sight over 400km, confirming this was a safe bet. Once it came time to do the whole world though, this wouldn't do.

> For more on why there's such a gap between the worst case line of sight and the actual longest line of 
> sight check out [this section](https://tombh.co.uk/packing-world-lines-of-sight) in Tom's blogpost.

Tom theorized that the actual worst case line of sight was 800km, which meant that
with an algorithm that has to check a DEM which has \\(n \times n\\) elevations, and checking a total of
\\(n\\) elevations along your line of sight for 360 angles, you are looking at potentially taking almost 2.4x longer
with a 1.3x longer worst case line of sight.

Tom's initial estimates were that this would cost us potentially hundreds of thousands of dollars and many months
of spot instance compute (meaning it could be shut down at any time). This was not feasible for either of our time
or money budgets, and I was certain that we could do better and calculate the whole world.

## Down the Rabbithole

After rubbing some braincells together on the problem and re-implementing the algorithm myself, I noticed a complete lack
of cache locality. Tom's total viewshed algorithms may not have to recompute the "deltas" for each point, but it
is effectively a single viewshed algorithm applied for every point. Not exactly good for having to compute every viewshed. 

The points are not processed in any particular order, meaning that while you are working from
left to right within the DEM, you are likely accessing completely different elevations.

{{< figure src="/lines-technical/diagonal.png" align=center >}}

This effectively benchmarks your processor's prefetcher with the number of cache misses you'll incur, not the FLOPs.

How bad are these cache misses? Well, the elevation data we have is at a resolution of 100m. For our lower-than-needed
upper bound of 600km for Mount Everest's we are talking 36 million elevations. Those elevations are stored as i16s 
totaling ~72MBs. Much bigger than what L3 can fit.

### Sorting By Lines of Sight

My mind first went to "sorting by lines of sight". Deltas take a single point and get us to the next point, but don't
care about what order you process points in. Since the next point is now in cache, it would be nice to reuse the data 
for the next line of sight calculation.

However, this falls flat on its face very quickly for a very simple reason: a line of sight is not contiguous in terms
of memory. By accessing non-contiguous memory you may be loading _some_ of the data into cache, but most of it is 
not being used in the line of sight calculation.

{{< figure src="/lines-technical/cache_waste.png" align=center caption="All the red bars are the full cache line of points your CPU fetches when asked to load the green points">}}


In fact, in the worst case, since elevation data is stored as an `i16` you are wasting 96% of a 64 byte cache line. OUCH.

With that much data being wasted, I set out to try to guarantee all data accesses for all lines of sight were contiguous,
and wouldn't you have it, all the squinting and rotating my head paid off.

### Spinning In Circles

After staring at deltas and their corresponding distances for much too long, the deltas for 45 degrees popped out to me 
as particularly interesting. Not only were lines of sight much faster to calculate for 45 degrees, but visualizing the
deltas showed that they create perfectly diagonal lines from the point of view and going across the DEM. 
The distances were also entirely uniform between points.

Since these lines are perfectly straight, why couldn't I make them entirely contiguous in memory and process the lines 
of sight from left to right instead of corner to corner?

{{< figure src="/lines-technical/rotated.png" align=center >}}

This looked absolutely too good to be true! Surely rotating the map only works for some points but not all. And maybe
it gets strange at angles that aren't divisible by 45 and the whole idea is dead in the water? Would the distances
be able to stay continuous? After wondering if this was doable or missing points, Tom and I sat down, convinced ourselves
that this was possible and generated this image:

{{< figure src="/lines-technical/logo.png" align=center caption="A circle seen forming in the center of the DEM from all the rotations">}}


Tom had already noticed that the original authors were only calculating lines of sight internally to the DEM.
When it came to calculating the full line of sight for every point they stopped short, mentioning it as a limitation
of the algorithm. This results in very few full viewsheds actually being valid.

However, if you have 3x the data padding the tile, all lines of sight will be able to be calculated for lines
of sight for all angles. While messing with rotations, we realized that only 2 times the data is required for computing 
the line of sight per angle. Instead of rotating the entire DEM, we only need to rotate a rectangular portion, 
which we nick-named the "chocolate bar"

{{< figure src="/lines-technical/chocolate_bar.png" align=center caption="A chocolate bar in all its glory">}}

The square tiles were now outliving their usefulness. When rotating the rectangle, it sometimes "juts" outside 
the DEM, meaning we don't have the data for it. We nick-named these "dolphins" because they create little triangles
when overlaid with the DEM that look like a dolphin's top fin.

{{< figure src="/lines-technical/dolphin.png" align=center width="100%" caption="A dolphin fin">}}

Dolphins occur because squares don't have infinite rotational symmetry so stuffing a rotated tile back into a square causes
it to be cut off. To fix this, we can just use circular tiles. The total viewshed is still padded with 3x the data,
except it is now 3 times the diameter of the worst-case longest line of sight.

The deltas and sector distances are dead! Viva la Rotación!

### The Stars (Mostly) Align

Now that we rotate the map, we completely front-load all our cache misses and perfectly align our data for our 
line of sight calculations. Of course, this is all unidirectional as we are only calculating the line of sight for all
points at a single angle. This rotation itself incurs roughly a one-second penalty for even the biggest DEMs. A huge win.

Cutting down the amount of data ends up meaning we can fit multiple widths worth of the DEM into L1 for calculation. 
Another HUGE win.

There is one downside that bears mentioning: when calculating the rotated coordinates for an elevation it may not fall 
between a single elevation evenly. You have to interpolate some elevation there so that a line of sight
calculation can be performed and not just have missing data. This is called _rasterization_.

{{< figure src="/lines-technical/rasterization.png" align=center caption="A rasterized triangle, courtesy of [scratchpixel](https://www.scratchapixel.com/lessons/3d-basic-rendering/rasterization-practical-implementation/rasterization-stage.html)">}}

We chose the "nearest neighbor" interpolation algorithm because it is extremely easy to implement and is considered to
be within the acceptable margins of error established in the academic viewshed literature (See Siham Tabik et al. in 
_Efficient Data Structure and Highly Scalable Algorithm for Total-Viewshed Computation_
https://ieeexplore.ieee.org/document/6837455).

Attempting to make rotation a function mapping coordinates from the unrotated image onto to the rotated one also runs 
into trouble. Streaks will be unfilled because it isn't guaranteed there is a one to one mapping of coordinates when
there is rounding involved. Mathematically, we can see this because rotated points aren't guaranteed to be unique
due to \\(\lfloor(x, y)\rceil\\) meaning this function isn't one to one:

$$
rotate(x, y, \theta):
\begin{bmatrix}
cos \theta & -sin \theta \\\
sin \theta & cos \theta
\end{bmatrix}
\begin{bmatrix}
x \\\
y
\end{bmatrix}
$$

$$
DEM = \\{ 0 \le  x < DEM_{width}; 0 \le y < DEM_{width} \mid (x, y)  \\}
$$

$$
DEM_{rotated} = \\{(x, y) \in DEM \mid \lfloor rotate(x, y, \theta) \rceil \\}
$$

$$
DEM \cap DEM_{rotated} \neq DEM
$$


This is solved by doing an "anti rotation". Looping over all the points of the output image, and choosing the closest 
coordinate in the input.

$$
anti\\_rotate(x, y, \theta): rotate(x, y, -\theta)
$$

$$
DEM_{rotated} = [ 0 \le  x < DEM_{width}; 0 \le y < DEM_{width} \mid DEM[\lfloor anti\\_rotate(x, y, \theta) \rceil] ]
$$

Now it is guaranteed there's a point in \\(DEM_{rotated}\\) for every \\((x, y)\\) but it isn't guaranteed to be unique.
This is fine for our purposes.

## A Brief Intermission

Get up, go get a drink of water or coffee, breathe a little. We're through the hardest part!

Please enjoy this palette cleanser of a Shiba who is a shop-keeper.
{{< rawhtml >}}
<div style="display: flex; justify-content: center">
<iframe width="560" height="315" src="https://www.youtube.com/embed/E6CcUj2mDbI" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen>
</iframe>
</div>

{{< /rawhtml >}}

## Finding The Longest Line of Sight

Once we developed the optimal cache setup to guarantee that our calculations are no longer
memory bound, the world became our oyster. A global total viewshed calculation seemed right on our doorstep.

Initial runs showed that our algorithm ran at about ~120 seconds per angle for Everest with very little optimization, just straight-line
Rust code. This timing means Everest takes 12 hours, but good news, it is single threaded so there's plenty more to go.

With the high-level architecture complete we decided to name our algorithm, _**CacheTVS**_.

CacheTVS has three different types of outputs: 
- the surface area heatmap, 
- the point-by-point longest line of sight, 
- the viewshed bitmaps

The surface area heatmap is an estimate of the visible area from a point of view. 

The point-by-point computation for the line of sight holds the angle and distance of the longest line of sight found.

The viewshed bitmaps are the boolean visibility computations out to the worst case line of sight for all 360 degrees.

We mainly only use the first two, as we calculated that storing the viewshed bitmap for Everest would be a few Terabytes
worth of information, and it doesn't actually give us anything extra. The world would be many Petabytes. We really only need a 
visualization of how much area each point can see, and of course the longest line of sight.

> Also, we personally don't have hard drives big enough :(

In total, we use exactly 8 times the amount of data of a single DEM which is entirely feasible and only around
200GB for the entire world.

### Parallelizing CacheTVS

As mentioned previously, all our initial tests were single threaded. Since the total viewshed calculation works
on an angle by angle snapshot of the data, we can already parallelize this by the number of cores what we have,
which for my machine is 8 cores. Because this workload is compute heavy, it doesn't make sense to make use of SMT
since threads will be fighting heavily for compute units.

To get the new time with 8-way parallelism, we just divide the amount of work, 360 angles, by the amount of cores
and multiply by the number of seconds.

$$
((360 / 8) * 120\space secs) / 60 \space secs \newline
= ~1.5 \space hrs
$$

We're under two hours!

### Optimizing Line of Sight Calculations

With the easy parallelization out of the way, it is time to see if we can squeeze extra parallelism out of our processor. 
There are many ways in which a CPU is parallel, not just multi-threading. You also have instruction-level
parallelism along with SIMD. Initially, lets focus on the first. Speaking of, what does our line of sight calculation currently look like?


```rust
fn line_of_sight(pov_height: i16, refraction: f32, elevations: &[i16]) -> (f32, f32) { // (surface area, distance)
    let mut highest_angle = -f32::INF;
    let mut longest_distance = 0.0f32;
    let mut surface_area = 0.0f32;
    
    for (distance, elevation) in elevations.enumerate() {
        // calculate the curve and refraction adjustment
        let curve_and_refraction = ((distance.ipow(2) as f32) * (1 - refraction)) / EARTH_DIAMETER;
        let elevation_prime = (elevation as f32) + curve_and_refraction
        
        // calculate the "angle" (really a ratio, not arctan)
        let angle = (elevation_prime - (pov_height as f32)) / distance
        
        // as we determined in the beginning, if the angle is higher,
        // then the point along our elevation map is visible.
        //
        // Add its area to the surface area, and update the longest
        // distance we've seen, and set it as the new highest angle
        if angle > highest_angle {
            longest_distance = distance as f32
            highest_angle = angle
            
            // TAN_ONE_RADIAN comes from the original paper. I'm not
            // sure that it is correct, but it makes for a decent estimate
            surface_area += distance * TAN_ONE_RADIAN
        }
    }
    
    (surface_area, longest_distance)
}
```

### ILP Go Brrrrr

The main performance issues of this loop arise because each iteration depends on the last.

CPUs work best when the next instruction doesn't depend on the result of any other instruction before it. It uses
_instruction pipelining_ to issue multiple instructions, allowing instructions to work in parallel so long as there 
are no inter-instruction dependencies. This is called Instruction Level Parallelism (ILP).

{{< figure src="/lines-technical/pipeline.png" align=center caption="A 5-stage CPU pipeline courtesy of GeekForGeeks">}}

In the case of the line of sight, the computation that is truly independent of any iteration is
the angle computation. It is only based on distance and elevation, not any angle before or after.

To be able to unshackle it from the loop-carry dependency, we will trade off storing and re-loading it from 
memory for extra ILP. Thankfully this all still fits in L1 so the ILP benefits far outweigh the memory cost.

We can rewrite the loop as follows:
```rust
fn line_of_sight(pov_height: i16, refraction: f32, elevations: &[i16], angle_buf: &mut [f32]) -> (f32, f32) { // (surface area, distance)
    assert_eq(elevations.len(), angle_buf.len())
    
    for (angle, (distance, elevation)) in zip(angle_buf.iter_mut(), elevations.enumerate()) {
        // calculate the curve and refraction adjustment
        let curve_and_refraction = ((distance.ipow(2) as f32) * (1 - refraction)) / EARTH_DIAMETER;
        let elevation_prime = (elevation as f32) + curve_and_refraction
        
        *angle = (elevation_prime - (pov_height as f32)) / distance
    }
    
    let mut highest_angle = -f32::INF;
    let mut longest_distance = 0.0f32;
    let mut surface_area = 0.0f32;
    
    for angle in angles {
        // as we determined in the beginning, if the angle is higher,
        // then the point along our elevation map is visible.
        //
        // Add its area to the surface area, and update the longest
        // distance we've seen, and set it as the new highest angle
        if angle > highest_angle {
            longest_distance = distance as f32
            highest_angle = angle
            
            // TAN_ONE_RADIAN comes from the original paper. I'm not
            // sure that it is correct, but it makes for a decent estimate
            surface_area += distance * TAN_ONE_RADIAN
        }
    }
    
    (surface_area, longest_distance)
}
```

We've now maximized the ILP of the angle calculation, but the longest line of sight calculation and
surface area calculation still aren't particularly parallel. Let's fix that!

### Prefix Sums and Scans

A prefix sum is a computation that takes a list of numbers and maps it to another list
where each element becomes the cumulative sum of all elements before it, hence its name. Here's a sample
implementation:

```rust

let nums = &[1, 2, 3, 4, 5];
let mut prefix_sum = &[0, 0, 0, 0, 0];

let mut prefix_acc = 0;
for (prefix, num) in zip(prefix_sum.iter_mut(), nums) {
    prefix_acc += num;
    *prefix_sum = num
}
```

Abstractly, a prefix sum is part of a general family of algorithms called an "inclusive scan". A scan is an even more general
algorithm that takes a sequence, an associative binary operator, and applies the binary operator to an accumulated value
and yields the newly accumulated value. Rust has this in its standard library with `.iter().scan()`

```rust
let nums = &[1, 2, 3, 4, 5];

// yields the same as above
let prefix_sum = nums
    .iter()
    .scan(0, |acc, elem| {
        *acc += elem;
        Some(*acc)
    })
    .collect()
```

Why do we care about scans? Well, for the real numbers `max` also happens to be an associative binary operator.

When we do our visibility calculations, we are comparing the current angle against the _highest_ angle:
```rust
if angle > highest_angle {
    longest_distance = distance as f32
    highest_angle = angle
    
    surface_area += distance * TAN_ONE_RADIAN
}
```

If we have a _prefix maximum_ of all the previous angles, then we could independently calculate
whether a particular point is visible by checking to see if `angle > prefix_max`.

Fortunately for us, `max` also happens to be associative for the floating point values that we compute. Generally speaking,
floating point values are not associative due to `NaN`s and signed zero. We never do any computation that
could yield either result, meaning we are safe to use `max` associatively.

> Interestingly, I'm not the first person to think about the application of a prefix maximum for
> line of sight visibility calculations. While researching the parallel prefix max, I stumbled upon this interesting
> [paper](https://www.cs.cmu.edu/~guyb/papers/Ble93.pdf) from all the way back in 1993. The author mentions line of
> sight visibility calculations as an off-hand example of a parallelizeable prefix scan:
> {{< figure src="/lines-technical/prefix_scan.png" width="75%" align=center caption="Great minds think alike, I guess" >}}

Scans also have two variants, inclusive and exclusive. Careful readers may have realized we aren't comparing the
highest angle to the prefix maximum which includes itself (like the above prefix sum). Instead, we are comparing
the angle to the maximum of all _previous_ angles (exclusive of itself). Thankfully switching from an inclusive to an 
exclusive scan fixes this.

If we allocate a second buffer and stuff the exclusive prefix maximum in there, our loop iterations
calculating the total surface area become entirely independent of one another. Calculating the longest
line of sight also falls out of our surface area calculation.

Here's the updated algorithm. I've broken it out into three methods as we now calculate the line of sight in 
three discrete steps:
- Angles
- Prefix maximum
- Visibility (surface area and longest line of sight)

```rust

fn calculate_angles(pov_height: f32, refraction: f32, angle_buf: &mut [f32], elevations: &[i16]) {
    for (angle, (distance, elevation)) in zip(angle_buf.iter_mut(), elevations.enumerate()) {

        let curve_and_refraction = ((distance.ipow(2) as f32) * (1 - refraction)) / EARTH_DIAMETER;
        let elevation_prime = (elevation as f32) + curve_and_refraction
        
        *angle = (elevation_prime - (pov_height as f32)) / distance
    }
}

fn prefix_max(prefix_max_buf: &mut [f32], angle_buf: &[f32]) {
    let mut highest_seen = -f32::INF;

     for (prefix_max, (distance, angle)) in zip(prefix_max_buf.iter_mut(), angles.enumerate()) {
        *prefix_max = highest_seen;
        highest_seen = max(*prefix_max, highest_seen);
    }
}

fn visibility(angles: &[f32], prefix_max: &[f32]) -> (f32, f32) {
    let longest_distance = 0.0f32;
    
    for ((distance, angle), prefix_max) in zip(angles.enumerate(), prefix_max) {
        if angle > prefix_max {
            surface_area += distance * TAN_ONE_RADIAN
            longest_distance = distance
        }
    }
    
    (surface_area, longest_distance)
}

fn line_of_sight(
    pov_height: i16, 
    refraction: f32,
    elevations: &[i16], 
    angle_buf: &mut [f32], 
    prefix_max_buf: &mut [f32],
) -> (f32, f32) { // (surface area, distance)
    assert_eq(elevations.len(), angle_buf.len())
    
    calculate_angles(pov_height as f32, refraction, angle_buf, elevations);
        
    prefix_max(prefix_max_buf, angle_buf);
    
    visibility(angles, prefix_max)
}
```

### Cache Pressure [Ain't Gonna Break My Stride](https://www.youtube.com/watch?v=B4c_SkROzzo)

Before parallelizing further, I noticed that our angle calculations redo the same curvature computation over and over.
When you have potentially hundreds of millions of lines of sight to process, that's quite a bit of extra computation. We haven't hit an issue
with cache pressure yet so let's pre-compute the curve and refraction adjustment, and also pre-compute the distances between points. 
Tiles generally are all of the same `scale`, 100m, but we add it in for future use:

```rust
// generate the curvature adjustments given the scale, refraction and worst case line of sight, `max_los`.
fn generate_distances(max_los: usize, refraction: f32, scale: f32) -> (Vec<f32>, Vec<f32>) {
    let adjusted_refraction = refraction - 1.0;

    (1..=max_los)
        .map(|step| {
            let distance = (step as f32) * scale;
            let adjustment = (distance * distance * adjusted_refraction) / EARTH_DIAMETER;

            (distance, adjustment)
        })
        .unzip()
}
```

We now can run this once and keep it out of our angle calculation loop. Nice!

> Close enough, welcome back sector distances.

### SIMD, Baby

We've almost squeezed every little bit of ILP out of our algorithm, so now is the time to talk about
another type of parallelism. SIMD.

SIMD stands for "Single Instruction Multiple Data". SIMD widens registers by multiple times the width
of data, say 8 `f32`s, and allows a single instruction to be issued to do computation on all elements at once. 

Because of the parallel nature of our computation, we are a good fit for rewriting the algorithm in SIMD. Instead of calculating
a single angle at a time, we can calculate 8 at a time on my x86 machine - which has AVX2 - and as we'll see later, up to 16 at a time on 
AVX-512 machines.

Rust currently has an unstable nightly feature called "portable SIMD" which lets us abstract over the hardware architecture,
which will work well for our most basic computations.

Trivially, we can use portable SIMD to widen both our angle and longest line of sight computations. Check it out:

```rust
// requires #![feature(portable_simd)]
use std::simd::prelude::SimdFloat as _;
use std::simd::{LaneCount, Simd, SupportedLaneCount};

// fancy itertools macro that lets us zip multiple iterators into one big unnested tuple
use itertools::izip;

fn calculate_angles<const VECTOR_WIDTH: usize>(
    pov_height: f32, 
    angles_out: &mut [f32], 
    elevations, distances, adjustments) 
where 
    LaneCount<VECTOR_WIDTH> : SupportedLaneCount   
{
    assert(elevations.len().is_multiple_of(VECTOR_WIDTH));
    
    // turn a &[f32] into a &[[f32; VECTOR_WIDTH]]. The r.h.s of the assignment
    // is the portion that doesn't fit into VECTOR_WIDTH, but we can ignore it since
    // the length of the slice is asserted to be a multiple of VECTOR_WIDTH
    let (vector_angles, _) = angles_out.as_chunks_mut::<{ VECTOR_WIDTH }>();
    let (vector_elevations, _) = elevations.as_chunks::<{ VECTOR_WIDTH }>();
    let (vector_adjustments, _) = adjustments.as_chunks::<{ VECTOR_WIDTH }>();
    let (vector_distances, _) = distances.as_chunks::<{ VECTOR_WIDTH }>();
    
    for (angle_out, &elevation, &distance, &adjustment) in izip!(
        vector_angles.iter_mut(),
        vector_elevations.iter(),
        vector_distances.iter(),
        vector_adjustments.iter()
    ) {
        let elevation_f32: Simd<f32, { VECTOR_WIDTH }> = Simd::from(elevation).cast();
        
        let elevation_prime = elevation_f32 + Simd::from_array(adjustment);
        let res = (elevation_prime - Simd::splat(pov_height)) / Simd::from_array(distance);
        
        res.copy_to_slice(angle_out);
    }    
}

fn visibility<const VECTOR_WIDTH: usize>(angles: &[f32], prefix_max: &[f32], distances: &[f32]) -> (f32, f32)
where 
    LaneCount<VECTOR_WIDTH> : SupportedLaneCount   
{
    assert(angles.len().is_multiple_of(VECTOR_WIDTH));

    let (vector_angles, _) = angles.as_chunks::<{ VECTOR_WIDTH }>();
    let (vector_prefix, _) = prefix_max.as_chunks::<{ VECTOR_WIDTH }>();
    let (vector_distances, _) = distances.as_chunks::<{ VECTOR_WIDTH }>();

    let (simd_area, simd_longest_distance) = izip(angles, distances, prefix_max)
        .fold((Simd::splat(0.0f32), Simd::splat(0.0f32)), |((acc_area, acc_distances), (angle, distance, prefix_max)) {
            let mask = angle.simd_gt(prefix_max);
            
            // if we don't have _any_ elements, then why carry out the rest of the computation?
            if !mask.any() {
                return (acc_area, acc_distances);
            }
            
            let selected_distances = mask.select(distance, Simd::splat(0.0f32));
            let surface_area = selected_distances * Simd::splat(TAN_ONE_RADIAN);
            
            (acc_area + surface_area, acc_distances.simd_max(selected_distances))
        }|
    }
    
    (simd_area.reduce_sum(), simd_longest_distance.reduce_max())
}
```

Programming with SIMD is a very different way of thinking because as you may notice, there are no conditionals.
Instead, each element is compared pairwise with each other to create a "mask". Then, you use
that mask to "select" which elements you want to use for true (the distances) and which to use
for false (zero).

Rust has some interesting codegen for the `!mask.any()` that I haven't fully grokked, so I'll leave it for a second blog
post. Suffice it to say that it still uses all vector instructions, and is able to shave 10% off of our time. 
If no points within the 8-wide vector are visible (which is very common), there's no reason to do any other calculation,
so there's at least some intuition as to why it is faster.

### x86 and IEEE754

Rust strives to be a safe language, so all float computations are done _without_ the fastmath flags. Enabling the fastmath
flags in Rust is annoying, and also not [recommended for various other reasons](https://simonbyrne.github.io/notes/fastmath/). 
One reason why you might want to turn on fastmath flags is that at least on x86, some instructions such as 
comparisons and floating point maximums end up generating a lot of extra instructions to comply with IEEE floating point 
standards because guess what: Intel's instructions don't.

For this project, we actually don't care a ton about the IEEE standard for comparison or maximum as we aren't
generating any `NaN`s or signed zero. For x86 we implement `max` with the `_mm_max_ps` intrinsic and implement greater than with `_mm_gt_ps`. No extra instructions.

This gets more important in our next section because we are going to make use of the `max` instruction quite a bit,
and we need to make sure the minimal number of instructions are generated. It's all to help us stop avoiding the SIMD 
elephant in the room: the prefix maximum calculation.

### Parallel Scans With SIMD

Calculating the prefix maximum with multiple threads would induce a huge amount of overhead for a small amount
of work, so instead we want to parallelize our prefix maximum via SIMD. The level of parallelism we get out of
the algorithm will be from clearing up the instruction pipeliner and keeping the carried dependencies minimal.

Because `max` is associative, we can calculate the prefix maximum for all the angles that fit within a
single SIMD register, keeping all calculations independent of one another and make ILP go brrr. 
Then we loop back over the data to propagate the maximum of each through the data. A common pattern you may be 
picking up on.

Onto an example. 

Let's say we have the following angles in two 4-wide registers.

```
[1, -1, 2, -2], [3, -3, 4, -4]
```

We can calculate the prefix max of the first register by shifting in an identity element - in our case `-f32::INF` 
since `max(x, -f32::INF) = x` - and applying our binary operator `max`. Then we take the result of that and shift in 
two identity elements to finish calculating the prefix max in-place:

```
max([   1,   -1,  2, -2],
    [-INF,    1, -1,  2])
= [1, max(-1, 1), max(2, -1), max(-2, -1)]
```

Then reuse that for the next in-place prefix max:
```
max([   1,  max(-1, 1), max(2, -1), max(-2, -1)], ; <- First iteration
    [-INF,        -INF,          1, max(1,  -1)]) ;  <- First iteration, shifted twice
= [1, max(-1, 1), max(max(2, -1), 1), max(max(-2, -1), max(1, -1))]
= [1, 1, 2, 2]
```

We do the same for the second register, independently:
```
max([   3,   -3,  4, -4],
    [-INF,    3, -3,  4])
= [3, max(-3, 3), max(4, -3), max(-4, 4)]
```

Which needs to be reused for the next in-place prefix max:

```
max([   3,  max(-3, 3), max(4, -3), max(-4, 4)],
    [-INF,        -INF,          3, max(1, -1)]
= [3, 3, 4, 4]
```

Now, we can take the maximum of the first register, which is always the last element, and splat it across a whole SIMD
register, then call `max` with it and the second register to complete the process:
```
max([3, 3, 4, 4],
    [2, 2, 2, 2])
= [3, 3, 4, 4]
```

No change here. But as you can see, associativity is what lets us do this prefix maximum calculation in-place
and lets us only do \\(log_2(4) = 2\\) calls to `max`. When we use 8 or 16 wide registers it is still \\(log_2\\),
so only a modest increase of one or two extra shifts. It also saves us from having to compute something 
like `max(max(max(1, -1), 2), -2)` which contains a computational dependency.

When it comes to accumulating the max from previous vectors to the next ones, we just keep an accumulated maximum
that we apply to each vector, completing the full scan and cementing our prefix maximum of all elements:
```rust
let mut local_acc = Simd::splat(highest);
for prefix in vector_prefix {
    let cur_prefix: f32x4 = Simd::from(*prefix);
    
    // get the highest form the current vector
    let cur_max: f32x4 = Simd::splat(cur_prefix[3]);
    
    // apply the accumulator to the current vector and store it back
    _mm_maxps(local_acc, cur_prefix).copy_to_slice(prefix);
    
    // make sure the accumulator holds the result of max(cur_prefix[3], local_acc)
    local_acc = _mm_maxps(local_acc, cur_max);
}
```


There's lots more details and not enough space, so if you are interested in the nitty-gritty, you can take a look at
[the implementation](https://github.com/AllTheLines/CacheTVS/blob/1bcc17c68114398209f027339bd81e810e6cf8c3/crates/total-viewsheds/src/cpu/vector_intrinsics.rs#L173) 
or take a look at [this website](https://en.algorithmica.org/hpc/algorithms/prefix/) or [this paper](https://www.adms-conf.org/2020-camera-ready/ADMS20_05.pdf) 
which were great guides.

### Reduction

Now that we are able to calculate the longest line of sight for a given point, we need to do this for every point on 
the map. Since we also only go in a single direction, we need to run that for every angle.

As cores finish up doing their single angle heatmap and line of sight calculation, we simply accumulate their results
into a single "final map". At the end, the map accumulates data for all 360 degrees and we're done! We have a total viewshed!

> It should be noted that there are a good number of cores that get wasted when running with a core count
> that doesn't evenly divide 360. Cores idling waiting for the next angle which doesn't come. This matters for runs
> bigger than a single tile - but we leave this as future work.

### Final Results

After implementing all of the above optimizations and absolutely squeezing the rock as hard as I could,
water did in fact come out. We took the computation from 120 seconds an angle, down to 

DRUM ROLL PLEASE

_**75 seconds per angle.**_

Astounding. This brought us down to 57 minutes for all of Everest on my 8 core machine.
Every little bit of optimization and tuning brought us here, and it was because of the hard work
we put in that we were getting very close to something usable for a world run. There was one last thing that was
holding me back: AVX-512.

Very, very recently, AMD released its Turin line of processor which has full AVX-512F support. Which means rather
than having AVX-512 be two AVX2 calculations in a trench-coat, it is a first-class citizen. Renting a top of the line AMD
Turin and our use of const generics and portable SIMD implementation let us seamlessly turn on support for a 
16-wide angle calculation, prefix max, and longest line of sight calculation. Enabling it _halved_ the time per angle,
cutting down the calculation to an average of 35 seconds per angle.

Using the Turins also unlocked a huge number of extra cores. I found that 48 cores was the sweet spot for our algorithm. 
Now instead of taking an hour, with 48 cores and AVX512, we were taking 4 minutes for all of Everest. **ALL OF EVEREST**.
This is a 160x speedup over the initial GPU algorithm.

## A Full World Run

Now that we were confident that we had the quickest algorithm we could think up, it was time to run the longest line
of sight algorithm for every tile in the whole world. Tom [calculated]([here](https://tombh.co.uk/packing-world-lines-of-sight)) 
the worst case line of sight which covered the globe. Chunking the world up ended with roughly 2500 tiles ranging 
from 50 kilometers across to a whopping 800km.

Since our algorithm is \\(O(n^3)\\) where \\(n\\) is the worst case line of sight, small tiles will run in much quicker than 
4 minutes, while larger tiles will take _much_ longer than 4 minutes. About 50% of the tiles are under 450km, whereas
50% of the total area of all tiles comes in at 1900 tiles and under 650km.

To process all the tiles, we took a stab at a Tom-and-Ryan version of a [MapReduce](https://static.googleusercontent.com/media/research.google.com/en//archive/mapreduce-osdi04.pdf)
cluster with 5 AMD Turin machines. We called it Atlas, and you can read about it [here](https://tombh.co.uk/longest-line-of-sight#atlas-the-automater).

All in all, the full world run took 18 hours and cost us a few hundred dollars which is much less than the
few hundred thousand that Tom initially estimated.

## The Final Product

Looking for the longest line of sight? Go check it out at [https://alltheviews.world](https://alltheviews.world) and see 
our curated list of the top ten longest lines of sight. You won't believe number 3!

Don't forget to go play with the interactive map at [https://map.alltheviews.world](https://mapalltheviews.world). Click
to find the longest line of sight for any point on earth, and zoom to even find the longest line of sight for your country or state!

If you would like to take a look at all the code this blog post is about, or have any ideas for improvements, here is the
GitHub link for our total viewshed algorithm, [CacheTVS](https://github.com/AllTheViews/CacheTVS).

## Acknowledgements

I'd like to acknowledge Tom for being the rock for which all this research was able to take place on top of.

I'd also like to acknowledge my family and friends for listening to my insane ramblings. They really didn't know 
much that was going on until it all came together, and they got to play around with the tool. Thanks for your patience!

So long, and thanks for all the fish!
