export enum align {
  start = 'justify-start',
  end = 'justify-end',
  around = 'justify-around',
  between = 'justify-between',
}

const classes = 'flex nowrap';

export function HBox({
  children,
  id,
  alignment = align.around,
  customStyles = '',
  width = 'w-full',
  onClick,
}: {
  children: any[] | any;
  id?: string;
  alignment?: align;
  customStyles?: string;
  width?: string;
  onClick?: (...args: any[]) => void;
}) {
  return (
    <div
      className={`${classes} flex-row ${width} items-center ${alignment} ${customStyles}`}
      id={id}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export function VBox({
  children,
  id,
  alignment = align.around,
  customStyles = '',
  height = 'h-full',
}: {
  children: any[] | any;
  id?: string;
  alignment?: align;
  customStyles?: string;
  height?: string;
}) {
  return (
    <div className={`${classes} flex-col ${height} content-around ${alignment} ${customStyles}`} id={id}>
      {children}
    </div>
  );
}

export function DoubleBox({
  firstChildren,
  secondChildren,
  firstStyle,
  secondStyle,
}: {
  firstChildren: JSX.Element | JSX.Element[] | string | number;
  secondChildren: JSX.Element | JSX.Element[] | string | number;
  firstStyle?: string;
  secondStyle?: string;
}) {
  return (
    <VBox>
      <HBox customStyles={firstStyle}>{firstChildren}</HBox>
      <HBox customStyles={secondStyle}>{secondChildren}</HBox>
    </VBox>
  );
}
