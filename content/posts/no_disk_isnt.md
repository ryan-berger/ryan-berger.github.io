---
title: "No, Disk Isn't Faster Than Memory"
subtitle: "test"
date: 2025-09-06T11:00:00-07:00
searchHidden: true
draft: true
---

A few days a HN article titled "Memory is Slow, Disk is Fast" hit the front page.
Even thought the post is clear engagement-bait to promote their "Agentic S3 Bill Optimizer", 
taking any criticism as bad-faith "erm actually", I do still think that the individual who
wrote the blog post holds these opinions. It does surprise me however, that a former researcher
would make this sloppy of mistakes in benchmarking. This may have to what is likely the _heavy_ use of
AI for root-cause analysis (this will become somewhat apparent later), but that is for a separate blog.
I'd rather engage with this work on its terms.

I was somewhat distraught because there were quite a few people engaging with the content at face-value. 
There were a few very good HN comments pushing back, I wouldn't say they are a strict majority.

I've also posted some responses in other forums, and have gotten back "well Ryan, this is more about
mmap vs io_uring". Which, sure, moderators at HN even changed the post title because this is the true result
it shows (kind of, we'll get to that). However, there was one very disturbing graph that 
almost everyone I have talked with has over-looked this particular graph that should nearly invalidate all the
other results in question:


INSERT PICTURE HERE


This surprised me as I'm not a hardware guy, if someone were to tell me that
their memory is faster than disk by only roughly 10%, I would be very suspect 
of the program they were running. And, if I personally were to benchmark something 
radically different from all benchmarks previously made in the history of benchmarks,
I don't think I would take those results at face value.

I believe in reproduction is good for science, and thankfully, the author provided
their code, meaning we can take a look.

I have two machines to benchmark this: an i9900K, with 128GB of DDR4 RAM and a 1TB SSD.
Because the author used an NVMe, I was unable to reproduce their io_uring results. On an SSD, it is much slower. 
So, I ran the io_uring benchmarks on my laptop which is a Framework 12 which has an NVMe, but only 32GB of RAM.

I get this isn't a perfect reproduction setup, but as we'll see in a moment, the order of magnitude
and closeness of results of smaller datasets on both machines should prove beyond a shadow of a doubt that
disk is not in fact faster than memory.

## The Experiment

First, let's clone the project [from here](https://www.bitflux.ai/blog/memory-is-slow-part2/) 
and build it. Checking it out and running `make`, we are greeted with some warning
but everything seems to work. First we need to create some test data, and there is a nice utility
`create_data <filename> <size in bytes>` to do this. Let's make a 50GB file and call it `test.bin`

```shell
$ ./create_data test.bin 50000000000
$ ls -hal
-rw-r--r-- 1 ryan ryan  47G Sep  5 19:37 test.bin
```

Perfect! We're ready to go.

### A Smoking Gun: Compiler Options

Looking inside the Makefile, we see what turns out to be the smoking gun: bad compiler options. Here is
what the author is using:

```Makefile
CC = g++
BUILD_TYPE ?= release

ifeq ($(BUILD_TYPE),debug)
    CFLAGS = -O0 -g -Wall -Wextra -std=c99 -D_GNU_SOURCE -DDEBUG_USLEEP=1
else
    CFLAGS = -O2 -Wall -Wextra -std=c99 -DNDEBUG -D_GNU_SOURCE
endif
```

`-O2` seems pretty suspect for a benchmark that should be showing
how fast we can read from RAM. Generally speaking `-O2` will not vectorize,
nor will it make use of the best AVX instructions.

Upping `-O2` to `-O3` doesn't solve the problem either. `g++` seems _very_ picky
about when it wants to vectorize, so you have to really push it with either a `#pragma unroll`,
or you need the magical incantation: `-march=core-avx2`. This will be important in a moment.

Let's run through each one with the old compiler options, and then my compiler options.

### Simple Loop

For the first test, the article runs the program twice. The first should warm up the buffer cache with the file,
the second should be quicker. Let's see if we can reproduce the first result with the i9900k and SSD since it has more
RAM for the buffer cache. The result says that the which says that a `mmap`'d 50GB file will process at ~.6GB/s
and then ~3GB/s after:

```shell
$ ./count_10_loop test.bin 50000000000
simple loop found 156276671 10s processed at 0.48 GB/s
./count_10_loop ../../test.bin 50000000000
simple loop found 156276671 10s processed at 6.38 GB/s
```

Our first result looks the same, but our second is about twice as fast. However, both of these are pretty easily
explained by the hardware. An i9900k which sits at 5GHz and overclocked DDR4 could definitely explain this. The
SSD over SATA explains the slower initial processing (although this seems to be within a margin of error).

Let's run the second with `-O3`:
```shell
 ./count_10_loop ../../test.bin 50000000000    
simple loop found 156276671 10s processed at 9.59 GB/s
```

Wow! That's quite a bit faster. A 150% performance increase just from `-O3`.

Funnily enough, at `-O2` with `clang`, we get similar numbers. Clang aggressively vectorizes,
and at `-O2 -march=core-avx2` we get double the speed:

```shell
./count_10_loop ../../test.bin 50000000000
simple loop found 156276671 10s processed at 12.21 GB/s
```

### Unrolled

When we run the unrolled version with the usual compiler options, we should expect roughly a 
doubling of speed, lets see what we get:

```shell
$ ./count_10_unrolled ../../test.bin 50000000000
unrolled loop found 156276671 10s processed at 11.13 GB/s
```

So looks like the benchmark works. Let's see what gcc can do at `-O3`:
```shell
$ ./count_10_unrolled ../../test.bin 50000000000                                     2 ↵
unrolled loop found 156276671 10s processed at 12.73 GB/s
```

Looks like it is about what simple loop at `-O2` does for clang.





