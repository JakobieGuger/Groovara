import { createClient } from "@/lib/supabase/server";

export type AuditEventType =
  | "auth_login"
  | "auth_oauth_login_success"
  | "auth_password_login_success"
  | "auth_password_login_failed"
  | "auth_password_signup_success"
  | "auth_password_signup_failed"
  | "spotify_connect"
  | "spotify_disconnect"
  | "tracklist_create"
  | "tracklist_delete"
  | "mixlist_create"
  | "mixlist_delete"
  | "settings_update"
  | "mixlist_visibility_change"
  | "failed_action";

export type AuditLogInput = {
  eventType: AuditEventType;
  userId: string;
  resourceType?: string | null;
  resourceId?: string | null;
  success?: boolean;
  action?: string;
  metadata?: Record<string, unknown>;
};

export async function writeAuditLog(input: AuditLogInput): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase.from("audit_logs").insert({
    user_id: input.userId,
    event_type: input.eventType,
    resource_type: input.resourceType ?? null,
    resource_id: input.resourceId ?? null,
    success: input.success ?? true,
    metadata: input.metadata ?? {},
  });

  if (error) {
    throw new Error(error.message || "Failed to write audit log.");
  }
}