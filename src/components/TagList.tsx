import { useData } from '../data/DataProvider';

export function useTagLabel() {
  const { dataset } = useData();
  const labels = new Map(dataset.tags_catalog.map((t) => [t.id, t.label]));
  return (id: string) => labels.get(id) ?? id;
}

export function TagList({ tags }: { tags: string[] }) {
  const label = useTagLabel();
  return (
    <ul className="tag-list" aria-label="Tags">
      {tags.map((t) => (
        <li key={t} className="tag">
          {label(t)}
        </li>
      ))}
    </ul>
  );
}
