DROP TRIGGER IF EXISTS on_new_shared_note ON public.shared_notes; CREATE TRIGGER on_new_shared_note AFTER INSERT ON public.shared_notes FOR EACH ROW EXECUTE FUNCTION public.dispatch_chat_push();;
