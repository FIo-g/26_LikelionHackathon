export type ConfirmationField = Readonly<{
  label: string;
  value: string;
}>;

type RecordConfirmationProps = Readonly<{
  title: string;
  fields: readonly ConfirmationField[];
}>;

export const RecordConfirmation = ({ title, fields }: RecordConfirmationProps) => {
  return (
    <section>
      <h2>{title}</h2>
      <dl>
        {fields.map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
};
