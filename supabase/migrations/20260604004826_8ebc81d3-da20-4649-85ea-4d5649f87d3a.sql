CREATE OR REPLACE FUNCTION public.generate_random_ticket_number(_ticket_type text, _draw_period_start date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _candidate integer;
  _exists boolean;
  _attempts integer := 0;
BEGIN
  LOOP
    _candidate := floor(random() * 9999 + 1)::integer;
    _attempts := _attempts + 1;

    SELECT EXISTS (
      SELECT 1 FROM public.lottery_tickets
      WHERE ticket_type = _ticket_type
        AND draw_period_start = _draw_period_start
        AND ticket_number = _candidate
    ) INTO _exists;

    IF NOT _exists THEN
      RETURN _candidate;
    END IF;

    IF _attempts > 200 THEN
      RAISE EXCEPTION 'Unable to generate unique random ticket number after 200 attempts';
    END IF;
  END LOOP;
END;
$function$;