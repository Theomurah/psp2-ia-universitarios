/**
 * T21 — Tela de configuração (perfil, semestre, matérias).
 *
 * Aluno pode editar todos os dados coletados no onboarding.
 *
 * [extra] Substituído alert() por toast; tratamento explícito de erro da mutation;
 * inclusão de campo "curso" + horários por matéria; layout em seções (cards).
 */

import { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ProfileFormSchema, type ProfileForm, DIAS_SEMANA } from '@psp2/shared';
import { useProfile, useUpdateProfile, MissingCursoColumnError } from '../hooks/useProfile';
import { useToast } from '../components/Toast';
import PrivacySection from '../components/PrivacySection';
import SystemPromptSection from '../components/SystemPromptSection';

const DIA_LABEL: Record<string, string> = {
  seg: 'Segunda',
  ter: 'Terça',
  qua: 'Quarta',
  qui: 'Quinta',
  sex: 'Sexta',
  sab: 'Sábado',
};

const TEAMS_LOGO =
  'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMjI4LjgzMyAyMDczLjMzMyI+CiAgPHBhdGggZmlsbD0iIzUwNTlDOSIgZD0iTTE1NTQuNjM3LDc3Ny41aDU3NS43MTNjNTQuMzkxLDAsOTguNDgzLDQ0LjA5Miw5OC40ODMsOTguNDgzYzAsMCwwLDAsMCwwdjUyNC4zOTgJYzAsMTk5LjkwMS0xNjIuMDUxLDM2MS45NTItMzYxLjk1MiwzNjEuOTUyaDBoLTEuNzExYy0xOTkuOTAxLDAuMDI4LTM2MS45NzUtMTYyLTM2Mi4wMDQtMzYxLjkwMWMwLTAuMDE3LDAtMC4wMzQsMC0wLjA1MlY4MjguOTcxCUMxNTAzLjE2Nyw4MDAuNTQ0LDE1MjYuMjExLDc3Ny41LDE1NTQuNjM3LDc3Ny41TDE1NTQuNjM3LDc3Ny41eiIvPgogIDxjaXJjbGUgZmlsbD0iIzUwNTlDOSIgY3g9IjE5NDMuNzUiIGN5PSI0NDAuNTgzIiByPSIyMzMuMjUiLz4KICA8Y2lyY2xlIGZpbGw9IiM3QjgzRUIiIGN4PSIxMjE4LjA4MyIgY3k9IjMzNi45MTciIHI9IjMzNi45MTciLz4KICA8cGF0aCBmaWxsPSIjN0I4M0VCIiBkPSJNMTY2Ny4zMjMsNzc3LjVINzE3LjAxYy01My43NDMsMS4zMy05Ni4yNTcsNDUuOTMxLTk1LjAxLDk5LjY3NnY1OTguMTA1CWMtNy41MDUsMzIyLjUxOSwyNDcuNjU3LDU5MC4xNiw1NzAuMTY3LDU5OC4wNTNjMzIyLjUxLTcuODkzLDU3Ny42NzEtMjc1LjUzNCw1NzAuMTY3LTU5OC4wNTNWODc3LjE3NglDMTc2My41NzksODIzLjQzMSwxNzIxLjA2Niw3NzguODMsMTY2Ny4zMjMsNzc3LjV6Ii8+CiAgPHBhdGggb3BhY2l0eT0iLjEiIGQ9Ik0xMjQ0LDc3Ny41djgzOC4xNDVjLTAuMjU4LDM4LjQzNS0yMy41NDksNzIuOTY0LTU5LjA5LDg3LjU5OAljLTExLjMxNiw0Ljc4Ny0yMy40NzgsNy4yNTQtMzUuNzY1LDcuMjU3SDY2Ny42MTNjLTYuNzM4LTE3LjEwNS0xMi45NTgtMzQuMjEtMTguMTQyLTUxLjgzMwljLTE4LjE0NC01OS40NzctMjcuNDAyLTEyMS4zMDctMjcuNDcyLTE4My40OVY4NzcuMDJjLTEuMjQ2LTUzLjY1OSw0MS4xOTgtOTguMTksOTQuODU1LTk5LjUySDEyNDR6Ii8+CiAgPHBhdGggb3BhY2l0eT0iLjIiIGQ9Ik0xMTkyLjE2Nyw3NzcuNXY4ODkuOTc4Yy0wLjAwMiwxMi4yODctMi40NywyNC40NDktNy4yNTcsMzUuNzY1CWMtMTQuNjM0LDM1LjU0MS00OS4xNjMsNTguODMzLTg3LjU5OCw1OS4wOUg2OTEuOTc1Yy04LjgxMi0xNy4xMDUtMTcuMTA1LTM0LjIxLTI0LjM2Mi01MS44MzMJYy03LjI1Ny0xNy42MjMtMTIuOTU4LTM0LjIxLTE4LjE0Mi01MS44MzNjLTE4LjE0NC01OS40NzYtMjcuNDAyLTEyMS4zMDctMjcuNDcyLTE4My40OVY4NzcuMDIJYy0xLjI0Ni01My42NTksNDEuMTk4LTk4LjE5LDk0Ljg1NS05OS41MkgxMTkyLjE2N3oiLz4KICA8cGF0aCBvcGFjaXR5PSIuMiIgZD0iTTExOTIuMTY3LDc3Ny41djc4Ni4zMTJjLTAuMzk1LDUyLjIyMy00Mi42MzIsOTQuNDYtOTQuODU1LDk0Ljg1NWgtNDQ3Ljg0CWMtMTguMTQ0LTU5LjQ3Ni0yNy40MDItMTIxLjMwNy0yNy40NzItMTgzLjQ5Vjg3Ny4wMmMtMS4yNDYtNTMuNjU5LDQxLjE5OC05OC4xOSw5NC44NTUtOTkuNTJIMTE5Mi4xNjd6Ii8+CiAgPHBhdGggb3BhY2l0eT0iLjIiIGQ9Ik0xMTQwLjMzMyw3NzcuNXY3ODYuMzEyYy0wLjM5NSw1Mi4yMjMtNDIuNjMyLDk0LjQ2LTk0Ljg1NSw5NC44NTVINjQ5LjQ3MgljLTE4LjE0NC01OS40NzYtMjcuNDAyLTEyMS4zMDctMjcuNDcyLTE4My40OVY4NzcuMDJjLTEuMjQ2LTUzLjY1OSw0MS4xOTgtOTguMTksOTQuODU1LTk5LjUySDExNDAuMzMzeiIvPgogIDxwYXRoIG9wYWNpdHk9Ii4xIiBkPSJNMTI0NCw1MDkuNTIydjE2My4yNzVjLTguODEyLDAuNTE4LTE3LjEwNSwxLjAzNy0yNS45MTcsMS4wMzcJYy04LjgxMiwwLTE3LjEwNS0wLjUxOC0yNS45MTctMS4wMzdjLTE3LjQ5Ni0xLjE2MS0zNC44NDgtMy45MzctNTEuODMzLTguMjkzYy0xMDQuOTYzLTI0Ljg1Ny0xOTEuNjc5LTk4LjQ2OS0yMzMuMjUtMTk4LjAwMwljLTcuMTUzLTE2LjcxNS0xMi43MDYtMzQuMDcxLTE2LjU4Ny01MS44MzNoMjU4LjY0OEMxMjAxLjQ0OSw0MTQuODY2LDEyNDMuODAxLDQ1Ny4yMTcsMTI0NCw1MDkuNTIyeiIvPgogIDxwYXRoIG9wYWNpdHk9Ii4yIiBkPSJNMTE5Mi4xNjcsNTYxLjM1NXYxMTEuNDQyYy0xNy40OTYtMS4xNjEtMzQuODQ4LTMuOTM3LTUxLjgzMy04LjI5MwljLTEwNC45NjMtMjQuODU3LTE5MS42NzktOTguNDY5LTIzMy4yNS0xOTguMDAzaDE5MC4yMjhDMTE0OS42MTYsNDY2LjY5OSwxMTkxLjk2OCw1MDkuMDUxLDExOTIuMTY3LDU2MS4zNTV6Ii8+CiAgPHBhdGggb3BhY2l0eT0iLjIiIGQ9Ik0xMTkyLjE2Nyw1NjEuMzU1djExMS40NDJjLTE3LjQ5Ni0xLjE2MS0zNC44NDgtMy45MzctNTEuODMzLTguMjkzCWMtMTA0Ljk2My0yNC44NTctMTkxLjY3OS05OC40NjktMjMzLjI1LTE5OC4wMDNoMTkwLjIyOEMxMTQ5LjYxNiw0NjYuNjk5LDExOTEuOTY4LDUwOS4wNTEsMTE5Mi4xNjcsNTYxLjM1NXoiLz4KICA8cGF0aCBvcGFjaXR5PSIuMiIgZD0iTTExNDAuMzMzLDU2MS4zNTV2MTAzLjE0OGMtMTA0Ljk2My0yNC44NTctMTkxLjY3OS05OC40NjktMjMzLjI1LTE5OC4wMDMJaDEzOC4zOTVDMTA5Ny43ODMsNDY2LjY5OSwxMTQwLjEzNCw1MDkuMDUxLDExNDAuMzMzLDU2MS4zNTV6Ii8+CiAgPGxpbmVhckdyYWRpZW50IGlkPSJhIiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgeDE9IjE5OC4wOTkiIHkxPSIxNjgzLjA3MjYiIHgyPSI5NDIuMjM0NCIgeTI9IjM5NC4yNjA3IiBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDEgMCAwIC0xIDAgMjA3NS4zMzMzKSI+CiAgICA8c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiM1YTYyYzMiLz4KICAgIDxzdG9wIG9mZnNldD0iLjUiIHN0b3AtY29sb3I9IiM0ZDU1YmQiLz4KICAgIDxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iIzM5NDBhYiIvPgogIDwvbGluZWFyR3JhZGllbnQ+CiAgPHBhdGggZmlsbD0idXJsKCNhKSIgZD0iTTk1LjAxLDQ2Ni41aDk1MC4zMTJjNTIuNDczLDAsOTUuMDEsNDIuNTM4LDk1LjAxLDk1LjAxdjk1MC4zMTJjMCw1Mi40NzMtNDIuNTM4LDk1LjAxLTk1LjAxLDk1LjAxCUg5NS4wMWMtNTIuNDczLDAtOTUuMDEtNDIuNTM4LTk1LjAxLTk1LjAxVjU2MS41MUMwLDUwOS4wMzgsNDIuNTM4LDQ2Ni41LDk1LjAxLDQ2Ni41eiIvPgogIDxwYXRoIGZpbGw9IiNGRkYiIGQ9Ik04MjAuMjExLDgyOC4xOTNINjMwLjI0MXY1MTcuMjk3SDUwOS4yMTFWODI4LjE5M0gzMjAuMTIzVjcyNy44NDRoNTAwLjA4OFY4MjguMTkzeiIvPgo8L3N2Zz4K';

const APRENDER3_LOGO =
  'data:image/jpeg;base64,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';

const SIGAA_LOGO =
  'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjxzdmcKICAgeG1sbnM6ZGM9Imh0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvIgogICB4bWxuczpjYz0iaHR0cDovL2NyZWF0aXZlY29tbW9ucy5vcmcvbnMjIgogICB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiCiAgIHhtbG5zOnN2Zz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciCiAgIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIKICAgeG1sbnM6c29kaXBvZGk9Imh0dHA6Ly9zb2RpcG9kaS5zb3VyY2Vmb3JnZS5uZXQvRFREL3NvZGlwb2RpLTAuZHRkIgogICB4bWxuczppbmtzY2FwZT0iaHR0cDovL3d3dy5pbmtzY2FwZS5vcmcvbmFtZXNwYWNlcy9pbmtzY2FwZSIKICAgdmlld0JveD0iMCAwIDEyMDAgNjAwIgogICBoZWlnaHQ9IjYwMCIKICAgd2lkdGg9IjEyMDAiCiAgIHhtbDpzcGFjZT0icHJlc2VydmUiCiAgIGlkPSJzdmcyIgogICB2ZXJzaW9uPSIxLjEiCiAgIGlua3NjYXBlOnZlcnNpb249IjAuOTEgcjEzNzI1IgogICBzb2RpcG9kaTpkb2NuYW1lPSJhc192ZXJ0X2Nvci5zdmciPjxzb2RpcG9kaTpuYW1lZHZpZXcKICAgICBwYWdlY29sb3I9IiNmZmZmZmYiCiAgICAgYm9yZGVyY29sb3I9IiM2NjY2NjYiCiAgICAgYm9yZGVyb3BhY2l0eT0iMSIKICAgICBvYmplY3R0b2xlcmFuY2U9IjEwIgogICAgIGdyaWR0b2xlcmFuY2U9IjEwIgogICAgIGd1aWRldG9sZXJhbmNlPSIxMCIKICAgICBpbmtzY2FwZTpwYWdlb3BhY2l0eT0iMCIKICAgICBpbmtzY2FwZTpwYWdlc2hhZG93PSIyIgogICAgIGlua3NjYXBlOndpbmRvdy13aWR0aD0iMjU2MCIKICAgICBpbmtzY2FwZTp3aW5kb3ctaGVpZ2h0PSIxMDE3IgogICAgIGlkPSJuYW1lZHZpZXcxOSIKICAgICBzaG93Z3JpZD0iZmFsc2UiCiAgICAgaW5rc2NhcGU6em9vbT0iMC45MDUwOTY2OCIKICAgICBpbmtzY2FwZTpjeD0iNzAyLjQ2NTgzIgogICAgIGlua3NjYXBlOmN5PSIyOTQuNTg4MjgiCiAgICAgaW5rc2NhcGU6d2luZG93LXg9Ii04IgogICAgIGlua3NjYXBlOndpbmRvdy15PSItOCIKICAgICBpbmtzY2FwZTp3aW5kb3ctbWF4aW1pemVkPSIxIgogICAgIGlua3NjYXBlOmN1cnJlbnQtbGF5ZXI9InN2ZzIiIC8+PG1ldGFkYXRhCiAgICAgaWQ9Im1ldGFkYXRhOCI+PHJkZjpSREY+PGNjOldvcmsKICAgICAgICAgcmRmOmFib3V0PSIiPjxkYzpmb3JtYXQ+aW1hZ2Uvc3ZnK3htbDwvZGM6Zm9ybWF0PjxkYzp0eXBlCiAgICAgICAgICAgcmRmOnJlc291cmNlPSJodHRwOi8vcHVybC5vcmcvZGMvZGNtaXR5cGUvU3RpbGxJbWFnZSIgLz48ZGM6dGl0bGU+PC9kYzp0aXRsZT48L2NjOldvcms+PC9yZGY6UkRGPjwvbWV0YWRhdGE+PGRlZnMKICAgICBpZD0iZGVmczYiPjxjbGlwUGF0aAogICAgICAgaWQ9ImNsaXBQYXRoMjAiCiAgICAgICBjbGlwUGF0aFVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGgKICAgICAgICAgaWQ9InBhdGgxOCIKICAgICAgICAgZD0ibSAwLDAgNTEwLDAgMCw0NjkuNzUgLTUxMCwwIHoiCiAgICAgICAgIGlua3NjYXBlOmNvbm5lY3Rvci1jdXJ2YXR1cmU9IjAiIC8+PC9jbGlwUGF0aD48L2RlZnM+PGcKICAgICBpZD0iZzMzODUiCiAgICAgdHJhbnNmb3JtPSJtYXRyaXgoMS44OTI4NDQ1LDAsMCwxLjg5Mjg0NDUsLTE0LjA2NzI5NSwtMTMuNzY3MTcpIj48cGF0aAogICAgICAgaW5rc2NhcGU6Y29ubmVjdG9yLWN1cnZhdHVyZT0iMCIKICAgICAgIGQ9Im0gNy40MzE4NjQzLDMyNC4yNTY1MSA2MzMuOTY2NDU1NywwIDAsLTMxNi45ODMyMyAtNjMzLjk2NjQ1NTcsMCB6IgogICAgICAgc3R5bGU9ImZpbGw6I2ZmZmZmZjtmaWxsLW9wYWNpdHk6MTtmaWxsLXJ1bGU6bm9uemVybztzdHJva2U6bm9uZSIKICAgICAgIGlkPSJwYXRoMjIiIC8+PHBhdGgKICAgICAgIGlua3NjYXBlOmNvbm5lY3Rvci1jdXJ2YXR1cmU9IjAiCiAgICAgICBkPSJtIDU0My42Mzk1NiwxMjIuNTIwMjUgYyAtMzEuOTk5MzksMjMuMDY4MjggLTY2Ljk4MzI1LDQzLjA2MDEzIC0xMDQuNjgwNzUsNTkuMzY3OTYgLTE4LjYyODgyLDguMDU3NjIgLTM4LjcwNzY0LDEzLjYyOSAtNTkuODUzNzcsMTYuMjc0MjggLTE1LjAzNjc2LDEuODc4NjcgLTMwLjM0OTM0LDIuODI0MjEgLTQ1Ljg4MDYxLDIuODI0MjEgbCAwLDEyMy4yNjk4MSAzMDguMTczODksMCAwLC0yNzIuMzI2NDkgLTk3Ljc1MDA3LDcwLjYwMDE3IC0wLjAwOSwtMC4wMSIKICAgICAgIHN0eWxlPSJmaWxsOiMwMDg5NDA7ZmlsbC1vcGFjaXR5OjE7ZmlsbC1ydWxlOm5vbnplcm87c3Ryb2tlOm5vbmUiCiAgICAgICBpZD0icGF0aDMwIiAvPjxwYXRoCiAgICAgICBpbmtzY2FwZTpjb25uZWN0b3ItY3VydmF0dXJlPSIwIgogICAgICAgZD0ibSAxMDUuMTg2NjYsMTIyLjUyMDI1IGMgMzIuMDA5NTcsMjMuMDY4MjggNjYuOTg4NDYsNDMuMDYwMTMgMTA0LjY5MDkzLDU5LjM2Nzk2IDE4LjYzMjU1LDguMDU3NjIgMzguNzAxNDMsMTMuNjI5IDU5Ljg1NzUsMTYuMjc0MjggMTUuMDI2ODEsMS44Nzg2NyAzMC4zMzk0LDIuODI0MjEgNDUuODgwNjEsMi44MjQyMSBsIDAsMTIzLjI2OTgxIC0zMDguMTgzODM1NywwIDAsLTI3Mi4zMjY0OSA5Ny43NDk5NDU3LDcwLjYwMDE3IDAuMDA1LC0wLjAxIgogICAgICAgc3R5bGU9ImZpbGw6IzAwODk0MDtmaWxsLW9wYWNpdHk6MTtmaWxsLXJ1bGU6bm9uemVybztzdHJva2U6bm9uZSIKICAgICAgIGlkPSJwYXRoMzIiIC8+PHBhdGgKICAgICAgIGlua3NjYXBlOmNvbm5lY3Rvci1jdXJ2YXR1cmU9IjAiCiAgICAgICBkPSJtIDMzMy4yMjQ0Myw3LjI3MzI4IDAsMTc2LjA5OTcyIGMgMTQuNzg4MjUsMCAyOS4zNzg5NCwtMC45MTIgNDMuNjkxMzIsLTIuNjgzOCBsIDAsMCBjIDE5LjQ1MjYsLTIuNDM2NTUgMzcuOTExMiwtNy41NTY5IDU1LjA0NDA1LC0xNC45NjM0NSAzNi41MTcxMiwtMTUuNzkzNDMgNzAuMzc1MjgsLTM1LjE0NDE1IDEwMS4zNjU3NSwtNTcuNDg5MjkgbCAwLDAuMDA1IDEwOC4wNzI3NywtNzguMDUwMjEgMCwtMjIuOTE3OTQgLTMwOC4xNzM4OSwwIgogICAgICAgc3R5bGU9ImZpbGw6IzEzM2U3OTtmaWxsLW9wYWNpdHk6MTtmaWxsLXJ1bGU6bm9uemVybztzdHJva2U6bm9uZSIKICAgICAgIGlkPSJwYXRoMzQiIC8+PHBhdGgKICAgICAgIGlua3NjYXBlOmNvbm5lY3Rvci1jdXJ2YXR1cmU9IjAiCiAgICAgICBkPSJtIDMxNS42MTU3LDcuMjczMjggMCwxNzYuMDk5NzIgYyAtMTQuODAzMTYsMCAtMjkuMzc3NywtMC45MTIgLTQzLjY5MTMyLC0yLjY4MzggbCAtMC4wMDUsMCBjIC0xOS40NTc1NywtMi40MzY1NSAtMzcuOTE5OSwtNy41NTY5IC01NS4wNTI3NSwtMTQuOTYzNDUgLTM2LjUwODQyLC0xNS43OTM0MyAtNzAuMzY2NTgsLTM1LjE0NDE1IC0xMDEuMzY2MjUsLTU3LjQ4OTI5IGwgMCwwLjAwNSAtMTA4LjA2ODU0NTcsLTc4LjA1MDIxIDAsLTIyLjkxNzk0IDMwOC4xODM4MzU3LDAiCiAgICAgICBzdHlsZT0iZmlsbDojMTMzZTc5O2ZpbGwtb3BhY2l0eToxO2ZpbGwtcnVsZTpub256ZXJvO3N0cm9rZTpub25lIgogICAgICAgaWQ9InBhdGgzNiIgLz48L2c+PC9zdmc+';

const MOODLE_LOGO =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjMwLjg3IDMxNS4xOCI+CiAgPHBhdGggZmlsbD0iI2Y5ODAxMiIgZD0iTTI4OS42MSAzMDkuNzdWMjAxLjUxcTAtMzMuOTQtMjgtMzMuOTV0LTI4LjA2IDMzLjk1djEwOC4yNkgxNzguNFYyMDEuNTFxMC0zMy45NC0yNy41Ny0zMy45NS0yOC4wNSAwLTI4IDMzLjk1djEwOC4yNkg2Ny42N1YxOTUuMTJxMC0zNS40MyAyNC42LTUzLjYzIDIxLjY2LTE2LjI1IDU4LjU2LTE2LjI1IDM3LjQxIDAgNTUuMTIgMTkuMTkgMTUuMjYtMTkuMTkgNTUuNjItMTkuMTkgMzYuOSAwIDU4LjU0IDE2LjI1IDI0LjYgMTguMTkgMjQuNjEgNTMuNjN2MTE0LjY1Wm02NzUuNDktLjVWMGg1NS4xNnYzMDkuMjdabS03MC4zIDB2LTE4LjIycS03LjM5IDkuODQtMjUuMTEgMTUuNzZhOTIuODEgOTIuODEgMCAwIDEtMzAuMDUgNS40MXEtMzkuNCAwLTYzLjI4LTI3LjA5dC0yMy44OS02N2MwLTI2LjI1IDcuNzYtNDguMyAyMy40LTY2IDEzLjg1LTE1LjY1IDM2LjM1LTI2LjU5IDYyLjI5LTI2LjU5IDI5LjIyIDAgNDYuMjggMTEgNTYuNjQgMjMuNjNWMGg1My42OHYzMDkuMjdabTAtMTAyLjkycTAtMTQuNzgtMTQtMjguMzNUODUyIDE2NC40N3EtMjEuMTYgMC0zMy40OCAxNy4yNC0xMC44NSAxNS4zLTEwLjg0IDM3LjQzIDAgMjEuNjggMTAuODQgMzYuOTQgMTIuMyAxNy43NSAzMy40OCAxNy43MyAxMi44MSAwIDI3LjgzLTEyLjA3dDE1LTI0Ljg2Wk02NDguNTcgMzE0LjE5cS00MS44NyAwLTY5LjE5LTI2LjU5VDU1MiAyMTkuMTRxMC00MS44MyAyNy4zNC02OC40NXQ2OS4xOS0yNi41OXE0MS44NSAwIDY5LjQ0IDI2LjU5dDI3LjU4IDY4LjQ1cTAgNDEuODgtMjcuNTggNjguNDZ0LTY5LjQgMjYuNTlabTAtMTQ1Ljc3cS0xOS45NCAwLTMwLjY1IDE1LjF0LTEwLjcxIDM1Ljg4cTAgMjAuNzggMTAgMzUuMTMgMTEuNDYgMTYuMzQgMzEuNCAxNi4zMlQ2ODAgMjU0LjUzcTEwLjQ2LTE0LjM0IDEwLjQ2LTM1LjEzdC0xMC0zNS4xM3EtMTEuNDYtMTUuODYtMzEuODktMTUuODVaTTQ0OS4xMyAzMTQuMTlxLTQxLjg2IDAtNjkuMi0yNi41OXQtMjcuMzMtNjguNDZxMC00MS44MyAyNy4zMy02OC40NXQ2OS4yLTI2LjU5cTQxLjgzIDAgNjkuNDQgMjYuNTl0MjcuNTcgNjguNDVxMCA0MS44OC0yNy41NyA2OC40NnQtNjkuNDQgMjYuNTlabTAtMTQ1Ljc3cS0xOS45NCAwLTMwLjY2IDE1LjF0LTEwLjcxIDM1Ljg4cTAgMjAuNzggMTAgMzUuMTMgMTEuNDYgMTYuMzQgMzEuNDEgMTYuMzJ0MzEuMzktMTYuMzJRNDkxIDI0MC4xOSA0OTEgMjE5LjR0LTEwLTM1LjEzcS0xMS40NC0xNS44Ni0zMS44Ny0xNS44NVptNjM2LjQ1IDY3LjQ3YzEuMTggMTMuMTMgMTguMjUgNDEuMzcgNDYuMzEgNDEuMzcgMjcuMzEgMCA0MC4yMy0xNS43NyA0MC44Ny0yMi4xNmw1OC4xMS0uNWMtNi4zNCAxOS4zOS0zMi4xIDYwLjU4LTEwMCA2MC41OC0yOC4yNCAwLTU0LjA4LTguNzktNzIuNjQtMjYuMzVzLTI3LjgyLTQwLjQ1LTI3LjgyLTY4LjdxMC00My44MyAyNy44Mi02OS42OHQ3Mi4xNi0yNS44NXE0OC4yNSAwIDc1LjM0IDMyIDI1LjEzIDI5LjUzIDI1LjEyIDc5LjI4Wm05MC4xMy0zNGMtMi4zLTExLjgzLTcuMjMtMjEuNDktMTQuNzctMjkuMDZxLTEyLjgyLTEyLjMtMjkuNTUtMTIuMzEtMTcuMjUgMC0yOC44MiAxMS44MnQtMTUuNSAyOS41NVoiLz4KICA8cGF0aCBmaWxsPSIjMzMzIiBkPSJtMTc0Ljc0IDExNi45IDU0Ljc0LTQwLS43LTIuNDRDMTMwIDg2LjU3IDg1LjA4IDk1LjE1IDAgMTQ0LjQ3bC43OSAyLjI0IDYuNzYuMDdjLS42MiA2LjgxLTEuNyAyMy42NC0uMzIgNDguOTUtOS40NCAyNy4zMi0uMjQgNDUuODggOC40IDY2LjA3IDEuMzctMjEgMS4yMy00NC01LjIyLTY2Ljg5LTEuMzUtMjUuMTQtLjI0LTQxLjY3LjM3LTQ4LjFsNTYuNC41NGEyNTggMjU4IDAgMCAwIDEuNjcgMzMuMDZjNTAuNCAxNy43MS0xMDEuMDktLjA2IDEyOC00My43Mi03LjQ3LTguMzctMjIuMTEtMTkuNzktMjIuMTEtMTkuNzlaIi8+Cjwvc3ZnPg==';

const INTEGRATIONS = [
  { id: 'teams', name: 'Microsoft Teams', logo: TEAMS_LOGO },
  { id: 'aprender3', name: 'Aprender 3', logo: APRENDER3_LOGO },
  { id: 'sigaa', name: 'SIGAA', logo: SIGAA_LOGO },
  { id: 'moodle', name: 'Moodle', logo: MOODLE_LOGO },
] as const;

export default function SettingsPage() {
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const toast = useToast();

  const { register, control, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting, isDirty } } = useForm<ProfileForm>({
    resolver: zodResolver(ProfileFormSchema),
    defaultValues: {
      full_name: '',
      curso: '',
      semestre_atual: '2026.1',
      materias: [{ code: '', nome: '', horarios: [] }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'materias' });
  const materias = watch('materias');

  useEffect(() => {
    if (profile) {
      reset({
        full_name: profile.full_name ?? '',
        curso: profile.curso ?? '',
        semestre_atual: profile.semestre_atual ?? '2026.1',
        materias: profile.materias.length > 0
          ? profile.materias
          : [{ code: '', nome: '', horarios: [] }],
      });
    }
  }, [profile, reset]);

  const onSubmit = async (data: ProfileForm) => {
    try {
      await updateProfile.mutateAsync(data);
      toast.success('Configurações salvas', 'Seu perfil foi atualizado.');
    } catch (err) {
      if (err instanceof MissingCursoColumnError) {
        toast.warning(
          'Curso não foi salvo',
          'A coluna "curso" ainda não existe no banco. Aplique a migration 0003. O resto foi salvo.',
        );
        return;
      }
      toast.error('Não foi possível salvar', (err as Error).message);
    }
  };

  const onInvalid = () => {
    toast.warning('Há campos inválidos', 'Confira os erros marcados em vermelho.');
  };

  const addHorario = (materiaIdx: number) => {
    const current = materias[materiaIdx]?.horarios ?? [];
    setValue(`materias.${materiaIdx}.horarios`, [
      ...current,
      { dia: 'seg', inicio: '08:00', fim: '10:00' },
    ], { shouldDirty: true });
  };

  const removeHorario = (materiaIdx: number, horarioIdx: number) => {
    const current = materias[materiaIdx]?.horarios ?? [];
    setValue(
      `materias.${materiaIdx}.horarios`,
      current.filter((_, i) => i !== horarioIdx),
      { shouldDirty: true },
    );
  };

  if (isLoading) {
    return (
      <div className="container">
        <div className="full-page-loader" style={{ minHeight: '40vh' }}>
          <span className="spinner" />
          <span>Carregando perfil…</span>
        </div>
      </div>
    );
  }

  return (
    // O <form> do perfil NÃO envolve mais SystemPromptSection/PrivacySection:
    // Enter num input dessas seções (ex: confirmação "EXCLUIR") disparava a
    // submissão implícita do perfil (auditoria 2026-06-10, WEB-ROUTES-03).
    <div className="container">
      <form className="settings" onSubmit={handleSubmit(onSubmit, onInvalid)}>
      <header>
        <h1>Configurações</h1>
        <p className="hint">
          Esses dados ajudam o sistema a classificar seus documentos automaticamente
          e a organizar tudo no seu Drive por semestre/matéria.
        </p>
      </header>

      <section className="settings-section">
        <h2>Perfil</h2>
        <label className="field">
          <span>Nome completo</span>
          <input
            type="text"
            placeholder="Theo Murah"
            aria-invalid={errors.full_name ? true : undefined}
            aria-describedby={errors.full_name ? 'set-err-full-name' : undefined}
            {...register('full_name')}
          />
          {errors.full_name && <em id="set-err-full-name" role="alert" className="error">{errors.full_name.message}</em>}
        </label>

        <label className="field">
          <span>Curso</span>
          <input
            type="text"
            placeholder="Engenharia de Produção"
            aria-invalid={errors.curso ? true : undefined}
            aria-describedby={errors.curso ? 'set-err-curso' : undefined}
            {...register('curso')}
          />
          {errors.curso && <em id="set-err-curso" role="alert" className="error">{errors.curso.message}</em>}
        </label>

        <label className="field">
          <span>Semestre atual</span>
          <input
            type="text"
            placeholder="2026.1"
            aria-invalid={errors.semestre_atual ? true : undefined}
            aria-describedby={errors.semestre_atual ? 'set-err-semestre' : undefined}
            {...register('semestre_atual')}
          />
          {errors.semestre_atual && <em id="set-err-semestre" role="alert" className="error">{errors.semestre_atual.message}</em>}
        </label>
      </section>

      <section className="settings-section">
        <h2>Matérias</h2>
        <p className="hint" style={{ marginTop: '-0.5rem' }}>
          Adicione cada matéria do semestre com seu código curto (ex: <code>FISICA3</code>) e horários opcionais.
        </p>

        {fields.map((field, idx) => {
          const horarios = materias[idx]?.horarios ?? [];
          return (
            <div key={field.id} className="settings-section" style={{ background: 'var(--bg-muted)', boxShadow: 'none' }}>
              <div className="materia-row">
                <input
                  type="text"
                  placeholder="FISICA3"
                  aria-label="Código curto"
                  {...register(`materias.${idx}.code` as const)}
                />
                <input
                  type="text"
                  placeholder="Física 3"
                  aria-label="Nome da matéria"
                  {...register(`materias.${idx}.nome` as const)}
                />
                <div />
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  className="ghost"
                  disabled={fields.length === 1}
                  aria-label="Remover matéria"
                >
                  Remover
                </button>
              </div>
              {errors.materias?.[idx]?.code && (
                <em className="error">{errors.materias[idx]?.code?.message}</em>
              )}
              {errors.materias?.[idx]?.nome && (
                <em className="error">{errors.materias[idx]?.nome?.message}</em>
              )}

              <div className="horario-grid">
                {horarios.map((_, hIdx) => (
                  <div key={hIdx} className="horario-row">
                    <select {...register(`materias.${idx}.horarios.${hIdx}.dia` as const)}>
                      {DIAS_SEMANA.map((d) => (
                        <option key={d} value={d}>{DIA_LABEL[d]}</option>
                      ))}
                    </select>
                    <input
                      type="time"
                      aria-label="Início"
                      {...register(`materias.${idx}.horarios.${hIdx}.inicio` as const)}
                    />
                    <input
                      type="time"
                      aria-label="Fim"
                      {...register(`materias.${idx}.horarios.${hIdx}.fim` as const)}
                    />
                    <button
                      type="button"
                      onClick={() => removeHorario(idx, hIdx)}
                      className="ghost"
                      aria-label="Remover horário"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => addHorario(idx)} className="link">
                  + Adicionar horário
                </button>
              </div>
            </div>
          );
        })}
        {errors.materias && typeof errors.materias.message === 'string' && (
          <em className="error">{errors.materias.message}</em>
        )}

        <button type="button" onClick={() => append({ code: '', nome: '', horarios: [] })} className="secondary">
          + Adicionar matéria
        </button>
      </section>

      <section className="settings-section">
        <h2>Integrações</h2>
        <p className="hint" style={{ marginTop: '-0.5rem' }}>
          Conecte sistemas da UnB e ferramentas externas para puxar materiais e avisos automaticamente.
        </p>

        <div className="integration-grid">
          {INTEGRATIONS.map((it) => (
            <button
              key={it.id}
              type="button"
              className="integration-card"
              onClick={() => toast.info('Em breve', `A integração com ${it.name} ainda não está disponível.`)}
              aria-label={`Integração com ${it.name} — em breve`}
            >
              <img src={it.logo} alt="" className="integration-logo" />
              <span className="integration-name">{it.name}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="actions-row">
        <button type="submit" className="primary" disabled={isSubmitting || !isDirty}>
          {isSubmitting ? 'Salvando…' : 'Salvar alterações'}
        </button>
      </div>
      </form>

      {/* Form separado e sem submit: mantém o layout de `form.settings` do CSS
          e garante que Enter aqui dentro nunca salva o perfil. */}
      <form
        className="settings"
        style={{ marginTop: '1.25rem' }}
        aria-label="Outras configurações"
        onSubmit={(e) => e.preventDefault()}
      >
        <SystemPromptSection />

        <PrivacySection />
      </form>
    </div>
  );
}
