import React from 'react';

export enum align {
  start = 'justify-start',
  end = 'justify-end',
  around = 'justify-around',
  between = 'justify-between',
}

const classes = 'flex nowrap';

function HBox_(
  {
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
  },
  ref: any,
) {
  return (
    <div
      ref={ref}
      className={`${classes} flex-row ${width} items-center ${alignment} ${customStyles}`}
      id={id}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
export const HBox = React.forwardRef(HBox_);

function VBox_(
  {
    children,
    id,
    alignment = align.around,
    customClasses = '',
    height = 'h-full',
  }: {
    children: any[] | any;
    id?: string;
    alignment?: align;
    customClasses?: string;
    height?: string;
  },
  ref: any,
) {
  return (
    <div
      className={`${classes} flex-col ${height} content-around ${alignment} ${customClasses}`}
      id={id}
      ref={ref}
    >
      {children}
    </div>
  );
}
export const VBox = React.forwardRef(VBox_);

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
