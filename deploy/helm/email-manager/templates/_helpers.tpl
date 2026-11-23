{{- define "email-manager.fullname" -}}
{{- if contains .Chart.Name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name .Chart.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "email-manager.labels" -}}
app.kubernetes.io/name: {{ .Chart.Name }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Values.image.tag | default .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version }}
{{- end -}}

{{- define "email-manager.selectorLabels" -}}
app.kubernetes.io/name: {{ .Chart.Name }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "email-manager.image" -}}
{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}
{{- end -}}

{{- define "email-manager.secretName" -}}
{{ .Values.secrets.existingSecret | default (include "email-manager.fullname" .) }}
{{- end -}}

{{- define "email-manager.claimName" -}}
{{ .Values.persistence.existingClaim | default (printf "%s-data" (include "email-manager.fullname" .)) }}
{{- end -}}

{{- define "email-manager.env" -}}
- name: ALLOWED_EMAILS
  value: {{ required "allowedEmails is required" .Values.allowedEmails | quote }}
- name: DRY_RUN
  value: {{ .Values.dryRun | quote }}
- name: AI_DAILY_BUDGET_USD
  value: {{ .Values.aiDailyBudgetUsd | quote }}
- name: DATA_DIR
  value: /data
- name: EMBEDDING_CACHE_DIR
  value: {{ ternary "/data/models" "/models" .Values.persistence.enabled }}
{{- with .Values.publicUrl }}
- name: PUBLIC_URL
  value: {{ . | quote }}
{{- end }}
{{- with .Values.rspamdUrl }}
- name: RSPAMD_URL
  value: {{ . | quote }}
{{- end }}
{{- with .Values.ai.triageModel }}
- name: AI_TRIAGE_MODEL
  value: {{ . | quote }}
{{- end }}
{{- with .Values.ai.draftModel }}
- name: AI_DRAFT_MODEL
  value: {{ . | quote }}
{{- end }}
- name: DATABASE_URL
  valueFrom:
    secretKeyRef: { name: {{ include "email-manager.secretName" . }}, key: database-url }
{{- range $name, $key := dict "OPENAI_API_KEY" "openai-api-key" "TOKEN_ENCRYPTION_KEY" "token-encryption-key" "INTERNAL_TOKEN" "internal-token" }}
- name: {{ $name }}
  valueFrom:
    secretKeyRef: { name: {{ include "email-manager.secretName" $ }}, key: {{ $key }}, optional: true }
{{- end }}
{{- with .Values.extraEnv }}
{{ toYaml . }}
{{- end }}
{{- end -}}

{{- define "email-manager.podSecurityContext" -}}
runAsNonRoot: true
runAsUser: 65532
runAsGroup: 65532
fsGroup: 65532
seccompProfile:
  type: RuntimeDefault
{{- end -}}

{{- define "email-manager.securityContext" -}}
allowPrivilegeEscalation: false
readOnlyRootFilesystem: true
capabilities:
  drop: ["ALL"]
{{- end -}}

{{- define "email-manager.volumes" -}}
- name: tmp
  emptyDir: {}
{{- if .Values.persistence.enabled }}
- name: data
  persistentVolumeClaim:
    claimName: {{ include "email-manager.claimName" . }}
{{- else }}
- name: models
  emptyDir:
    sizeLimit: 1Gi
{{- end }}
{{- end -}}

{{- define "email-manager.volumeMounts" -}}
- name: tmp
  mountPath: /tmp
{{- if .Values.persistence.enabled }}
- name: data
  mountPath: /data
{{- else }}
- name: models
  mountPath: /models
{{- end }}
{{- end -}}

{{- define "email-manager.scheduling" -}}
{{- with .Values.imagePullSecrets }}
imagePullSecrets:
{{- toYaml . | nindent 2 }}
{{- end }}
{{- with .Values.nodeSelector }}
nodeSelector:
{{- toYaml . | nindent 2 }}
{{- end }}
{{- with .Values.tolerations }}
tolerations:
{{- toYaml . | nindent 2 }}
{{- end }}
{{- with .Values.affinity }}
affinity:
{{- toYaml . | nindent 2 }}
{{- end }}
{{- end -}}
