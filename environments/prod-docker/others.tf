# ===========================================================================
# prod-docker -- others.tf
#
# Commented-out Terraform for this environment. Two different reasons, kept
# apart by the section headers below:
#
#   1. SUPERSEDED IMAGE BUILDS. These `docker_image` blocks used to build the
#      image; the kreuzwerker/docker provider's `build { context = ... }` path
#      failed on these particular contexts, so each one became a
#      `null_resource.<name>_image` + `local-exec docker build` at the bottom
#      of main.tf. Those builds are what run today, and the containers
#      reference the content-hash tag:
#          image      = "api-service-backend:${substr(null_resource.api_service_backend_image.triggers.dir_sha, 0, 12)}"
#          depends_on = [null_resource.api_service_backend_image]
#      To go back to a provider build: un-comment the docker_image block,
#      point that container's `image` at `docker_image.<name>.image_id`, and
#      drop its `depends_on` on the null_resource. Never keep both -- two
#      resources building the same tag is the "cannot re-use a name that is
#      still in use" error.
#
#   2. SERVICES NOT DEPLOYED. The Selenium grid is a local test rig, not part
#      of the city. The Online Compiler backend (D-10) used to sit here too
#      while server_new was rebuilt -- it is live in main.tf now, see section 2
#      below for how to park it again.
#
# Data-safety note: docker_volume.compiler_db_data / compiler_server_data and
# the legacy notes_* / *_pgdata / *_mysql / *_minio volume declarations stay in
# main.tf even though nothing mounts some of them now -- deleting a declaration
# makes the next apply delete the volume, and everything inside it.
#
# Nothing here is referenced by main.tf, so nothing here can produce a
# "resource not found" ordering error during a normal apply.
# ===========================================================================

# ---------------------------------------------------------------------------
# 1. Superseded docker_image builds -- each one has a live replacement in
#    main.tf: bank_frontend_build_image, video_backend_image,
#    api_service_backend_image, whisper_frontend_image,
#    hospital_management_image (all `null_resource` + `local-exec` builds).
#    grocery_backend_image / housing_backend_image are here too: those two
#    never had a docker_image block, they were written as null_resources from
#    the start, and are listed only to keep the pattern in one place.
# ---------------------------------------------------------------------------
# resource "docker_image" "bank_frontend_build" {
#   name         = "bank-frontend-build:latest"
#   keep_locally = true
#   build {
#     context    = abspath("${var.projects_dir}/Bank Manager/frontend")
#     dockerfile = "Dockerfile.prod"
#   }
#   triggers = {
#     dir_sha = sha256(join("", [
#       for f in fileset("${var.projects_dir}/Bank Manager/frontend", "**") :
#       filesha256("${var.projects_dir}/Bank Manager/frontend/${f}")
#       if !can(regex("(\\.git|node_modules|dist)", f))
#     ]))
#   }
# }

# resource "docker_image" "hospital_management" {
#   name         = "hospital_management:latest"
#   keep_locally = true
#   build {
#     context    = abspath("${var.projects_dir}/hospital_management")
#     dockerfile = "Dockerfile"
#   }
#   triggers = {
#     dir_sha = sha256(join("", [
#       for f in fileset("${var.projects_dir}/hospital_management", "**") :
#       filesha256("${var.projects_dir}/hospital_management/${f}")
#       if !can(regex("(\\.git|__pycache__|\\.pyc|staticfiles|media)", f))
#     ]))
#   }
# }

# resource "docker_image" "video_backend" {
#   name         = "video-uploader-backend:latest"
#   keep_locally = true
#   build {
#     context    = abspath("${var.projects_dir}/Video Uploader/Main/backend")
#     dockerfile = "Dockerfile"
#   }
#   triggers = {
#     dir_sha = sha256(join("", [
#       for f in fileset("${var.projects_dir}/Video Uploader/Main/backend", "**") :
#       filesha256("${var.projects_dir}/Video Uploader/Main/backend/${f}")
#       if !can(regex("(\\.git|__pycache__|\\.pyc)", f))
#     ]))
#   }
# }

# resource "docker_image" "api_service_backend" {
#   name         = "api-service-backend:latest"
#   keep_locally = true
#   build {
#     context    = abspath("${var.projects_dir}/API Service/backend")
#     dockerfile = "Dockerfile"
#   }
#   triggers = {
#     dir_sha = sha256(join("", [
#       for f in fileset("${trimsuffix(var.projects_dir, "/")}/API Service/backend", "**") :
#       filesha256("${trimsuffix(var.projects_dir, "/")}/API Service/backend/${f}")
#       if !can(regex("(\\.git|__pycache__|\\.pyc)", f))
#     ]))
#   }
# }

# resource "docker_image" "whisper_frontend" {
#   name         = "whisper-frontend:latest"
#   keep_locally = true
#   build {
#     context    = abspath("${var.projects_dir}/Whatsapp/whatsapp-frontend")
#     dockerfile = "Dockerfile.prod"
#   }
#   triggers = {
#     dir_sha = sha256(join("", [
#       for f in fileset("${var.projects_dir}/Whatsapp/whatsapp-frontend", "**") :
#       filesha256("${var.projects_dir}/Whatsapp/whatsapp-frontend/${f}")
#       if !can(regex("(\\.git|node_modules|dist)", f))
#     ]))
#   }
# }

# ---------------------------------------------------------------------------
# 2. Online Compiler backend (D-10) -- NOT parked, it lives in main.tf again
# ---------------------------------------------------------------------------
# docker_image.compiler_db, docker_image.compiler_server,
# docker_container.compiler_db and module.compiler_server are live in main.tf
# (next to the compiler frontend build), with CORS_ALLOWED_ORIGINS passed to
# both containers from local.compiler_origin. If the compiler ever has to be
# parked again: move those four blocks back here, keep every line commented
# with "# ", and delete their addresses from
# infra-cli/internal/deploy/import.go's dockerContainerCatalog -- a catalog
# entry for a resource that is not in the state gets offered on every
# `infra-cli import-state` run.
#
# docker_volume.compiler_db_data and compiler_server_data never moved; they
# stay declared in main.tf either way, because deleting a volume declaration
# deletes the data.

# ---------------------------------------------------------------------------
# 3. Selenium grid -- local test rig (8 cores / 12GB budget when enabled)
# ---------------------------------------------------------------------------
# # ---------------------------------------------------------------------------
# # Selenium (Chrome grid) for local test runs -- built from the compose at
# # ${var.projects_dir}/Selenium (services: "selenium" = selenium/standalone-chrome,
# # "java" = the test runner built from Selenium/java/selenium/Dockerfile).
# #
# # Capped at 8 cores / 12GB combined so your own Chrome + VS Code still have
# # headroom on the host -- see the resource-optimization thread. shm_size
# # mirrors the compose file's `shm_size: 2gb`; Chrome needs real /dev/shm or
# # it crashes mid-session under any real load.
# # ---------------------------------------------------------------------------
# resource "docker_volume" "selenium_chrome_profiles" {
#   # Declared in the source docker-compose.yml (top-level `volumes:
#   # chrome_profiles`) but not actually mounted by either service there --
#   # kept here 1:1 with the compose for now. Add a `volumes { }` block below
#   # if you start mounting it.
#   name = "selenium_chrome-profiles"
# }

# resource "docker_image" "selenium_chrome" {
#   name         = "selenium/standalone-chrome:latest"
#   keep_locally = true
# }

# resource "docker_container" "selenium_chrome" {
#   name    = "selenium"
#   image   = docker_image.selenium_chrome.image_id
#   restart = "unless-stopped"

#   env = [
#     "SE_NODE_MAX_SESSIONS=2",
#     "SE_NODE_OVERRIDE_MAX_SESSIONS=true",
#   ]

#   # Chrome/webdriver is the heavy half of the 8-core/12GB budget.
#   memory   = 8192   # MB
#   cpus     = "6"
#   shm_size = 2048   # MB == compose's `shm_size: 2gb`

#   ports {
#     internal = 4444
#     external = 4444
#   }
#   ports {
#     internal = 7900   # noVNC -- drop this block if you don't need to watch it run
#     external = 7900
#   }

#   networks_advanced { name = "gateway-net" }
# }

# resource "docker_image" "selenium_java" {
#   name         = "selenium-java-runner:latest"
#   keep_locally = true
#   build {
#     context    = abspath("${var.projects_dir}/Selenium/java/selenium")
#     dockerfile = "Dockerfile"
#   }
#   triggers = {
#     dir_sha = sha256(join("", [
#       for f in fileset("${var.projects_dir}/Selenium/java/selenium", "**") :
#       filesha256("${var.projects_dir}/Selenium/java/selenium/${f}")
#       if !can(regex("(\\.git|target|__pycache__)", f))
#     ]))
#   }
# }

# resource "docker_container" "selenium_java" {
#   name     = "selenium-java-runner"
#   image    = docker_image.selenium_java.image_id
#   must_run = true
#   restart  = "unless-stopped"

#   memory = 4096
#   cpus   = "2"

#   env = [
#     "JAVA_OPTS=-XX:MaxRAMPercentage=50.0 -XX:+UseG1GC -XX:MaxGCPauseMillis=100 -XX:+DisableExplicitGC",
#     "SE_JAVA_OPTS=-XX:MaxRAMPercentage=50.0 -XX:+UseG1GC -XX:MaxGCPauseMillis=100",
#   ]

#   networks_advanced { name = "gateway-net" }
#   depends_on = [docker_container.selenium_chrome]
# }
