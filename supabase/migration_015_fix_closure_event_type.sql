-- is_closure=true だが event_type が closure でないレコードを修正
update calendar_events
set event_type = 'closure'
where is_closure = true and (event_type is null or event_type != 'closure');
