-- Permite que o dono de uma imagem de capa a remova do storage
-- (usado quando o jogo é editado com nova imagem ou excluído).
create policy "game_covers_owner_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'game-covers' and owner = auth.uid());
