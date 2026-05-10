import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const createProjectRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      workerId: z.string().uuid(),
      agreedPrice: z.number().nullable().optional(),
      checkinRequired: z.boolean().optional(),
      checkoutRequired: z.boolean().optional(),
      photoFrequency: z.enum(["morning", "midday", "endofday"]).nullable().optional(),
      startDate: z.string().nullable().optional(),
      duration: z.string().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    if (data.workerId === userId) throw new Error("You cannot start a project with yourself");
    const { data: row, error } = await supabase
      .from("projects")
      .insert({
        owner_id: userId,
        worker_id: data.workerId,
        status: "pending",
        agreed_price: data.agreedPrice ?? null,
        checkin_required: !!data.checkinRequired,
        checkout_required: !!data.checkoutRequired,
        photo_frequency: data.photoFrequency ?? null,
        start_date: data.startDate || null,
        duration: data.duration || null,
        setup_completed: true,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

// Owner-initiated: created already-active so the owner is taken straight to setup.
export const createAcceptedProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ workerId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    if (data.workerId === userId) throw new Error("You cannot start a project with yourself");
    // Reuse an existing active+unfinished project between this owner & worker if any.
    const { data: existing } = await supabase
      .from("projects")
      .select("id")
      .eq("owner_id", userId)
      .eq("worker_id", data.workerId)
      .in("status", ["pending", "active"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing?.id) {
      const { error } = await supabase
        .from("projects")
        .update({ status: "active", setup_completed: false, completion_requested_by: null })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { id: existing.id };
    }
    const { data: row, error } = await supabase
      .from("projects")
      .insert({ owner_id: userId, worker_id: data.workerId, status: "active" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

const configureSchema = z.object({
  projectId: z.string().uuid(),
  agreedPrice: z.number().nullable().optional(),
  checkinRequired: z.boolean().optional(),
  checkoutRequired: z.boolean().optional(),
  photoFrequency: z.enum(["morning", "midday", "endofday"]).nullable().optional(),
  startDate: z.string().nullable().optional(),
  duration: z.string().nullable().optional(),
});

export const configureProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => configureSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: p, error: gerr } = await supabase
      .from("projects").select("owner_id, status").eq("id", data.projectId).maybeSingle();
    if (gerr) throw new Error(gerr.message);
    if (!p) throw new Error("Not found");
    if (p.owner_id !== userId) throw new Error("Only the owner can configure");
    if (p.status !== "active" && p.status !== "pending") throw new Error("Project must be accepted first");
    const { error } = await supabase
      .from("projects")
      .update({
        agreed_price: data.agreedPrice ?? null,
        checkin_required: !!data.checkinRequired,
        checkout_required: !!data.checkoutRequired,
        photo_frequency: data.photoFrequency ?? null,
        start_date: data.startDate || null,
        duration: data.duration || null,
        setup_completed: true,
        // After owner finalizes setup, worker must confirm before work begins.
        status: "pending",
        completion_requested_by: null,
      })
      .eq("id", data.projectId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const respondToProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ projectId: z.string().uuid(), accept: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: p, error: gerr } = await supabase
      .from("projects").select("worker_id, status").eq("id", data.projectId).maybeSingle();
    if (gerr) throw new Error(gerr.message);
    if (!p) throw new Error("Not found");
    if (p.worker_id !== userId) throw new Error("Only the worker can respond");
    if (p.status !== "pending") throw new Error("Already handled");
    const { error } = await supabase
      .from("projects")
      .update({ status: data.accept ? "active" : "declined" })
      .eq("id", data.projectId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const requestCompletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: p, error: gerr } = await supabase
      .from("projects").select("owner_id, worker_id, status").eq("id", data.projectId).maybeSingle();
    if (gerr) throw new Error(gerr.message);
    if (!p) throw new Error("Not found");
    if (p.owner_id !== userId && p.worker_id !== userId) throw new Error("Not a participant");
    if (p.status !== "active") throw new Error("Project must be active");
    const { error } = await supabase
      .from("projects")
      .update({ completion_requested_by: userId })
      .eq("id", data.projectId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const cancelCompletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("projects")
      .update({ completion_requested_by: null })
      .eq("id", data.projectId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const confirmCompletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: p, error: gerr } = await supabase
      .from("projects").select("completion_requested_by, owner_id, worker_id, status").eq("id", data.projectId).maybeSingle();
    if (gerr) throw new Error(gerr.message);
    if (!p) throw new Error("Not found");
    if (p.status !== "active" && !(p.status === "completed" && p.completion_requested_by)) throw new Error("Not active");
    if (!p.completion_requested_by) throw new Error("Nothing to confirm");
    if (p.completion_requested_by === userId) throw new Error("The other party must confirm");
    const { error } = await supabase
      .from("projects").update({ status: "completed", completion_requested_by: null }).eq("id", data.projectId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const submitRating = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      projectId: z.string().uuid(),
      stars: z.number().int().min(1).max(5),
      comment: z.string().max(100).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: p, error: gerr } = await supabase
      .from("projects").select("owner_id, worker_id, status").eq("id", data.projectId).maybeSingle();
    if (gerr) throw new Error(gerr.message);
    if (!p) throw new Error("Not found");
    if (p.status !== "completed") throw new Error("Project not completed");
    const ratedId = userId === p.owner_id ? p.worker_id : p.owner_id;
    const { error } = await supabase.from("project_ratings").insert({
      project_id: data.projectId,
      rater_id: userId,
      rated_id: ratedId,
      stars: data.stars,
      comment: data.comment || null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
