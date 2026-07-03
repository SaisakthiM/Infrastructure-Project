# Goes in: infra/environments/prod-infra/atlantis/Dockerfile
#
# Stock ghcr.io/runatlantis/atlantis ships terraform + conftest, but not
# terragrunt or kind -- both of which this repo's local-exec provisioners
# need (kind_cluster/kind_load_images in prod-social, terragrunt itself to
# run any environment at all). This is the pattern the Atlantis docs
# themselves recommend for adding terragrunt: FROM the official image,
# USER root, install, switch back.
#
# Deliberately NOT installing kubectl or helm CLIs -- the kubectl and helm
# *providers* this repo uses (gavinbunney/kubectl, hashicorp/helm) are
# native Go clients, they don't shell out to the kubectl/helm binaries, so
# Terraform never needs them on PATH. Add them here later only if a
# workflow step ever calls `kubectl`/`helm` directly.

ARG ATLANTIS_VERSION=v0.44.0
# TODO: confirm this is still the latest tag at https://github.com/runatlantis/atlantis/releases
# (or ghcr.io/runatlantis/atlantis tags) and pin deliberately -- don't just trust this default.
FROM ghcr.io/runatlantis/atlantis:${ATLANTIS_VERSION}

USER root

ARG TERRAGRUNT_VERSION=v1.0.8
# TODO: check https://github.com/gruntwork-io/terragrunt/releases for newer
ARG KIND_VERSION=v0.32.0
# TODO: check https://github.com/kubernetes-sigs/kind/releases for newer

# docker-cli: needed for the local-exec docker pull/save/cp/exec calls in
# prod-social's kind_images null_resource, and the docker run calls in
# prod-gateway's intro_page/record_page null_resources.
RUN apk add --no-cache docker-cli bash curl ca-certificates \
 && curl -fsSL -o /usr/local/bin/terragrunt \
      "https://github.com/gruntwork-io/terragrunt/releases/download/${TERRAGRUNT_VERSION}/terragrunt_linux_amd64" \
 && chmod +x /usr/local/bin/terragrunt \
 && curl -fsSL -o /usr/local/bin/kind \
      "https://kind.sigs.k8s.io/dl/${KIND_VERSION}/kind-linux-amd64" \
 && chmod +x /usr/local/bin/kind \
 && terragrunt --version \
 && kind version

# NOTE: the container is run as root (user = "0:0") in main.tf anyway, to
# read the host's docker.sock and ~/.kube/config -- see the comment there
# for why. This USER line is what the upstream Dockerfile itself would do;
# harmless to leave in, the docker_container resource overrides it.
USER atlantis