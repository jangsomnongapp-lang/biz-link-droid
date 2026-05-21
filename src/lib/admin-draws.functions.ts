import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

async function assertAdmin(userId: string) {
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!profile?.is_admin) throw new Error("Forbidden");
}

export const ensureScheduledDraws = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.rpc("ensure_scheduled_draws" as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const runAdminLotteryDraw = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ drawId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { data: result, error } = await supabaseAdmin.rpc("run_lottery_draw" as never, {
      _draw_id: data.drawId,
    } as never);
    if (error) throw new Error(error.message);
    return result as { ok: boolean; reason?: string };
  });

export const setAdminManualWinner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      drawId: z.string().uuid(),
      drawType: z.enum(["daily", "weekly", "monthly"]),
      drawPeriodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      ticketNumber: z.number().int().positive(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { data: ticket, error: tErr } = await supabaseAdmin
      .from("lottery_tickets")
      .select("id, user_id")
      .eq("ticket_type", data.drawType)
      .eq("draw_period_start", data.drawPeriodStart)
      .eq("ticket_number", data.ticketNumber)
      .eq("status", "active")
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!ticket) throw new Error("Ticket not found for this draw period");

    const { error } = await supabaseAdmin
      .from("lottery_draws")
      .update({
        winner_user_id: ticket.user_id,
        winning_ticket_id: ticket.id,
        status: "drawn",
        drawn_at: new Date().toISOString(),
      })
      .eq("id", data.drawId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });