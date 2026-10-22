# gitops/observability/unsynced

Nothing in this folder is deployed. `app_of_apps_observability`
(`environments/prod-infra/main.tf`) syncs **`gitops/observability/apps` with
`directory: recurse: false`**, which means every file in that directory has to
be a real Kubernetes manifest -- an `Application`, in this app-of-apps design.

Four files broke that rule, and each one is a "sometimes the deploy throws a
syncing error":

| File | Why it moved |
|---|---|
| `cassandra-values.yml` | Helm values (`replicaCount`, `image`, `jvm`). No `apiVersion`/`kind`, so ArgoCD's directory plugin reports it as an invalid manifest and the whole app-of-apps goes **ComparisonError**. Also dead: `gitops/platform/observability/jaeger-config.yml` sets `cassandra: false`. |
| `redis-values.yml` | Helm values for a Bitnami redis that no Application installs (`auth: { password: ... }`). |
| `otel-gateway-config.yml` | A **stale duplicate**. The collector config Terraform actually bind-mounts is `projects/platform/observability/otel-gateway-config.yml` (`local.obs_path` in prod-infra). This copy also starts with a comment block and has no `kind`. |
| `observability-redis-app.yaml` | A raw Deployment + Service (not an Application), in namespace `default`, whose pod reads Secret **`redis-auth-secret`** -- created only by the commented-out `kubectl_manifest.redis_auth_secret` in `environments/prod-infra/others.tf`. Synced as-is it produces a pod stuck at `CreateContainerConfigError: secret "redis-auth-secret" not found`. |

## To re-enable the observability redis

1. Un-comment `kubectl_manifest.redis_auth_secret` (and its `depends_on` on
   `null_resource.prod_social_ready`) in `environments/prod-infra/others.tf`,
   plus the matching header note in that file.
2. `git mv gitops/observability/unsynced/observability-redis-app.yaml gitops/observability/apps/`
   -- it is a valid manifest, so the app-of-apps will sync it into namespace
   `default` as soon as it sits in that directory.
3. Set `observability_redis_password` (already declared in
   `environments/prod-infra/variable.tf`, default `redis-password` -- rotate
   it) and apply prod-infra.
4. `redis-values.yml` / `cassandra-values.yml` are leftovers of older Helm
   charts; they have no consumer, so leave them here or delete them.
