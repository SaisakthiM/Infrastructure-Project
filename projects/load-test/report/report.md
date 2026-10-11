# Load teting report on 
## saisakthi.qzz.io

## 1. Hospital Management App


here is the load testing result for it first under 10

```bash
APP=hospital PEAK_VUS=10 docker compose run --rm k6-apps
Container load-test-k6-apps-run-593349fd2722 Creating 
Container load-test-k6-apps-run-593349fd2722 Created 

         /\      Grafana   /‾‾/  
    /\  /  \     |\  __   /  /   
   /  \/    \    | |/ /  /   ‾‾\ 
  /          \   |   (  |  (‾)  |
 / __________ \  |_|\_\  \_____/ 


     execution: local
        script: /work/loadtest-apps.js
        output: -

     scenarios: (100.00%) 1 scenario, 10 max VUs, 2m0s max duration (incl. graceful stop):
              * reads: Up to 10 looping VUs for 1m30s over 3 stages (gracefulRampDown: 30s, exec: reads, gracefulStop: 30s)



  █ THRESHOLDS 

    checks
    ✓ 'rate>0.95' rate=100.00%

    http_req_duration
    ✓ 'p(95)<2000' p(95)=789.31ms

    http_req_failed
    ✓ 'rate<0.05' rate=0.00%


  █ TOTAL RESULTS 

    checks_total.......: 1284    13.952266/s
    checks_succeeded...: 100.00% 1284 out of 1284
    checks_failed......: 0.00%   0 out of 1284

    ✓ hospital /hospital/
    ✓ hospital /hospital/patients/
    ✓ hospital /hospital/doctors/
    ✓ hospital /hospital/appointments/

    HTTP
    http_req_duration..............: avg=340.34ms min=158.08ms med=260.64ms max=2.34s p(90)=558.1ms p(95)=789.31ms
      { expected_response:true }...: avg=340.34ms min=158.08ms med=260.64ms max=2.34s p(90)=558.1ms p(95)=789.31ms
    http_req_failed................: 0.00%  0 out of 1284
    http_reqs......................: 1284   13.952266/s

    EXECUTION
    iteration_duration.............: avg=2.38s    min=1.25s    med=2.18s    max=7.92s p(90)=3.22s   p(95)=3.79s   
    iterations.....................: 321    3.488066/s
    vus............................: 1      min=1         max=10
    vus_max........................: 10     min=10        max=10

    NETWORK
    data_received..................: 22 MB  236 kB/s
    data_sent......................: 181 kB 2.0 kB/s




running (1m32.0s), 00/10 VUs, 321 complete and 0 interrupted iterations
reads ✓ [======================================] 00/10 VUs  1m30s
```

and the stats overtime 

```bash
  docker stats --no-stream | grep hospital
7cc9951da219   hospital-management                  6.74%     27.63MiB / 512MiB     5.40%     435kB / 5.98MB    230MB / 89.7MB    9
  docker stats --no-stream | grep hospital
7cc9951da219   hospital-management                  12.70%    69.55MiB / 512MiB     13.58%    511kB / 7.34MB    266MB / 89.8MB    9
  docker stats --no-stream | grep hospital
7cc9951da219   hospital-management                  8.28%     64.29MiB / 512MiB     12.56%    571kB / 8.42MB    266MB / 89.9MB    9
  docker stats --no-stream | grep hospital
7cc9951da219   hospital-management                  7.25%     27.91MiB / 512MiB     5.45%     951kB / 15.1MB    267MB / 106MB     9
  docker stats --no-stream | grep hospital
7cc9951da219   hospital-management                  2.40%     26.57MiB / 512MiB     5.19%     1.23MB / 20MB     269MB / 106MB     9
```


now the same but scaled to 100 virtual users 

```bash
 APP=hospital PEAK_VUS=100 docker compose run --rm k6-apps
Container load-test-k6-apps-run-6da8574e30cc Creating 
Container load-test-k6-apps-run-6da8574e30cc Created 

         /\      Grafana   /‾‾/  
    /\  /  \     |\  __   /  /   
   /  \/    \    | |/ /  /   ‾‾\ 
  /          \   |   (  |  (‾)  |
 / __________ \  |_|\_\  \_____/ 


     execution: local
        script: /work/loadtest-apps.js
        output: -

     scenarios: (100.00%) 1 scenario, 100 max VUs, 2m0s max duration (incl. graceful stop):
              * reads: Up to 100 looping VUs for 1m30s over 3 stages (gracefulRampDown: 30s, exec: reads, gracefulStop: 30s)



  █ THRESHOLDS 

    checks
    ✓ 'rate>0.95' rate=100.00%

    http_req_duration
    ✓ 'p(95)<2000' p(95)=1.4s

    http_req_failed
    ✓ 'rate<0.05' rate=0.00%


  █ TOTAL RESULTS 

    checks_total.......: 7356    80.558968/s
    checks_succeeded...: 100.00% 7356 out of 7356
    checks_failed......: 0.00%   0 out of 7356

    ✓ hospital /hospital/
    ✓ hospital /hospital/patients/
    ✓ hospital /hospital/doctors/
    ✓ hospital /hospital/appointments/

    HTTP
    http_req_duration..............: avg=790.64ms min=151.17ms med=726.82ms max=3.95s  p(90)=1.12s p(95)=1.4s 
      { expected_response:true }...: avg=790.64ms min=151.17ms med=726.82ms max=3.95s  p(90)=1.12s p(95)=1.4s 
    http_req_failed................: 0.00%  0 out of 7356
    http_reqs......................: 7356   80.558968/s

    EXECUTION
    iteration_duration.............: avg=4.17s    min=1.35s    med=3.97s    max=10.13s p(90)=5.54s p(95)=6.88s
    iterations.....................: 1839   20.139742/s
    vus............................: 3      min=3         max=100
    vus_max........................: 100    min=100       max=100

    NETWORK
    data_received..................: 125 MB 1.4 MB/s
    data_sent......................: 1.5 MB 16 kB/s




running (1m31.3s), 000/100 VUs, 1839 complete and 0 interrupted iterations
reads ✓ [======================================] 000/100 VUs  1m30s

```

and the stats overtime 

```bash
❯ docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"  | grep hospital
hospital-management                  34.22%    29.41MiB / 512MiB
❯ docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"  | grep hospital
hospital-management                  23.25%    57.19MiB / 512MiB
❯ 
❯ docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"  | grep hospital
hospital-management                  21.29%    63.16MiB / 512MiB
❯ docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"  | grep hospital
hospital-management                  40.25%    55.24MiB / 512MiB
❯ docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"  | grep hospital
hospital-management                  31.98%    35.32MiB / 512MiB
❯ docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"  | grep hospital
hospital-management                  33.31%    54.7MiB / 512MiB
❯ docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"  | grep hospital
hospital-management                  15.56%    54.2MiB / 512MiB

```

and it passed. handling over 80 req/sec and it is doing good. but here is the same run in another time we did before 

```bash
APP=hospital PEAK_VUS=100 docker compose run --rm k6-apps
Container load-test-k6-apps-run-ffbf629361d3 Creating 
Container load-test-k6-apps-run-ffbf629361d3 Created 

         /\      Grafana   /‾‾/  
    /\  /  \     |\  __   /  /   
   /  \/    \    | |/ /  /   ‾‾\ 
  /          \   |   (  |  (‾)  |
 / __________ \  |_|\_\  \_____/ 


     execution: local
        script: /work/loadtest-apps.js
        output: -

     scenarios: (100.00%) 1 scenario, 100 max VUs, 2m0s max duration (incl. graceful stop):
              * reads: Up to 100 looping VUs for 1m30s over 3 stages (gracefulRampDown: 30s, exec: reads, gracefulStop: 30s)



  █ THRESHOLDS 

    checks
    ✓ 'rate>0.95' rate=100.00%

    http_req_duration
    ✗ 'p(95)<2000' p(95)=3.17s

    http_req_failed
    ✓ 'rate<0.05' rate=0.00%


  █ TOTAL RESULTS 

    checks_total.......: 3504    37.920731/s
    checks_succeeded...: 100.00% 3504 out of 3504
    checks_failed......: 0.00%   0 out of 3504

    ✓ hospital /hospital/
    ✓ hospital /hospital/patients/
    ✓ hospital /hospital/doctors/
    ✓ hospital /hospital/appointments/

    HTTP
    http_req_duration..............: avg=2s    min=185.53ms med=2.02s max=7.44s  p(90)=2.67s p(95)=3.17s
      { expected_response:true }...: avg=2s    min=185.53ms med=2.02s max=7.44s  p(90)=2.67s p(95)=3.17s
    http_req_failed................: 0.00%  0 out of 3504
    http_reqs......................: 3504   37.920731/s

    EXECUTION
    iteration_duration.............: avg=9.03s min=1.67s    med=9.08s max=16.39s p(90)=12.4s p(95)=13.6s
    iterations.....................: 876    9.480183/s
    vus............................: 12     min=5         max=100
    vus_max........................: 100    min=100       max=100

    NETWORK
    data_received..................: 60 MB  648 kB/s
    data_sent......................: 714 kB 7.7 kB/s




running (1m32.4s), 000/100 VUs, 876 complete and 0 interrupted iterations
reads ✓ [======================================] 000/100 VUs  1m30s
ERRO[0093] thresholds on metrics 'http_req_duration' have been crossed 
```

see, the same run, no code change we did before can't even handle 30 req/sec but now it handles over 7000 request with over 80 req/sec. Network always changes and this is primarily due to the randomness, one small latency in your network or a cloudflare modified headers and you will get completely different results. median is around 730ms which is not bad for my standards (I really did not even expect this much from python in the first place) but it did suprise me that just doing it in random time will literally changes results 

I don't have a plan to improve more, handling 80 req/sec itself is good to me and most startups handle around what, a 5000 req/sec if that is big enough, we can make optimization but we have to ask, is that worth the time we are giving to it

now testing under 1000 Virtual users 

```bash
❯ APP=hospital PEAK_VUS=1000 docker compose run --rm k6-apps
Container load-test-k6-apps-run-dbf7c08953cb Creating 
Container load-test-k6-apps-run-dbf7c08953cb Created 

         /\      Grafana   /‾‾/  
    /\  /  \     |\  __   /  /   
   /  \/    \    | |/ /  /   ‾‾\ 
  /          \   |   (  |  (‾)  |
 / __________ \  |_|\_\  \_____/ 


     execution: local
        script: /work/loadtest-apps.js
        output: -

     scenarios: (100.00%) 1 scenario, 1000 max VUs, 2m0s max duration (incl. graceful stop):
              * reads: Up to 1000 looping VUs for 1m30s over 3 stages (gracefulRampDown: 30s, exec: reads, gracefulStop: 30s)



  █ THRESHOLDS 

    checks
    ✓ 'rate>0.95' rate=100.00%

    http_req_duration
    ✗ 'p(95)<2000' p(95)=14.59s

    http_req_failed
    ✓ 'rate<0.05' rate=0.00%


  █ TOTAL RESULTS 

    checks_total.......: 9124    77.34018/s
    checks_succeeded...: 100.00% 9124 out of 9124
    checks_failed......: 0.00%   0 out of 9124

    ✓ hospital /hospital/
    ✓ hospital /hospital/patients/
    ✓ hospital /hospital/doctors/
    ✓ hospital /hospital/appointments/

    HTTP
    http_req_duration..............: avg=9.79s min=447.97ms med=10.55s max=17.35s p(90)=14.09s p(95)=14.59s
      { expected_response:true }...: avg=9.79s min=447.97ms med=10.55s max=17.35s p(90)=14.09s p(95)=14.59s
    http_req_failed................: 0.00%  0 out of 9124
    http_reqs......................: 9124   77.34018/s

    EXECUTION
    iteration_duration.............: avg=40.3s min=5.22s    med=42.65s max=52.28s p(90)=48.2s  p(95)=49.4s 
    iterations.....................: 2281   19.335045/s
    vus............................: 1      min=1         max=1000
    vus_max........................: 1000   min=1000      max=1000

    NETWORK
    data_received..................: 160 MB 1.4 MB/s
    data_sent......................: 3.5 MB 30 kB/s




running (1m58.0s), 0000/1000 VUs, 2281 complete and 1 interrupted iterations
reads ✓ [======================================] 0000/1000 VUs  1m30s
ERRO[0118] thresholds on metrics 'http_req_duration' have been crossed 
```
it literally crossed 14 seconds, and 

```bash
❯ docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"  | grep hospital
hospital-management                  50.44%    55.62MiB / 512MiB
❯ docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"  | grep hospital
hospital-management                  33.74%    58.54MiB / 512MiB
❯ docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"  | grep hospital
hospital-management                  19.99%    56.56MiB / 512MiB
❯ docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"  | grep hospital
hospital-management                  42.69%    60.65MiB / 512MiB
❯ docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"  | grep hospital
hospital-management                  48.32%    55.52MiB / 512MiB
❯ docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"  | grep hospital
hospital-management                  8.98%     24.16MiB / 512MiB
❯ docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"  | grep hospital
hospital-management                  40.77%    61.02MiB / 512MiB
```

and if you noticed it closely nothing ever crossed over 50 or if if did it came down, you know why here is the answer

```bash
module "hospital_management" {
  # --- resource optimization pass ---
  # NOTE: modules/docker_app must declare `memory` (number, MB) and
  # `cpus` (string) variables and forward them to its docker_container
  # resource for these two lines to actually do anything -- see the
  # module patch in the chat reply.
  memory = 512
  cpus   = "0.5"
  source        = "../../modules/docker_app"
  name          = "hospital-management"
  image         = "hospital_management:latest"
  internal_port = 8000
  external_port = 0
  network       = "gateway-net"
}
```

I literally limited it's roof to only around 0.5 cores, the fact that it fully served all 9000 request without dropping or crashing is impressive

so for the solution , we can just assign it 1 or 2 cores but for us we only have around 12 cores and remember we have a cluster of 2 worker nodes and 1 control nodes

sometimes, it's not just the code is the constrain to performance, we always maps that but it's also the network and the environment we work on which also have a significant impact on the performance

so personally, I am satisfied with what I have in here, if it can handle that much without dropping and with 0.5 cores with 512MB ram for a embedded db and a django with a gunicorn server, nothing more to ask

https://forum.djangoproject.com/t/can-django-handle-100k-requests-per-second/35194

also see this for more detail on how you can improve on your django server