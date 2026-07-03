import { WebTracerProvider } from '@opentelemetry/sdk-trace-web'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { getWebAutoInstrumentations } from '@opentelemetry/auto-instrumentations-web'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { Resource } from '@opentelemetry/resources'
import { SEMRESATTRS_SERVICE_NAME } from '@opentelemetry/semantic-conventions'

const provider = new WebTracerProvider({
  resource: new Resource({
    [SEMRESATTRS_SERVICE_NAME]: 'social-frontend', // change per app
  }),
})

provider.addSpanProcessor(
  new BatchSpanProcessor(
    new OTLPTraceExporter({
      // goes through nginx → kind ingress → otel collector
      url: 'http://otel-collector.monitoring.svc.cluster.local:4317',
    })
  )
)

provider.register()

registerInstrumentations({
  instrumentations: [
    getWebAutoInstrumentations({
      '@opentelemetry/instrumentation-fetch': { enabled: true },
      '@opentelemetry/instrumentation-xml-http-request': { enabled: true },
      '@opentelemetry/instrumentation-document-load': { enabled: true },
    }),
  ],
})