import React from 'react';
import clsx from 'clsx';
import styles from './HomepageFeatures.module.css';

const FeatureList = [
  {
    title: 'Infrastructure Changes are Code',
    Svg: require('../../static/img/logo.svg').default,
    description: (
      <>
        Infrastructure state is data.
        Changing your infrastructure is a set of SQL queries to perform that read or change the data.
      </>
    ),
  },
  {
    title: 'Don\'t  Learn a New API (Probably)',
    Svg: require('../../static/img/logo.svg').default,
    description: (
      <>
        Most cloud backends already depend on a SQL database.
        Review changes to your IaSQL database using your backend's migration system, just like Infrastructure-as-Code.
      </>
    ),
  },
  {
    title: 'Safer infrastructure changes',
    Svg: require('../../static/img/logo.svg').default,
    description: (
      <>
        Unlike IaC, IaSQL makes the relations between pieces of your infrastructure first-class citizens, enforcing type safety on the data and changes to it.
      </>
    ),
  },
];

function Feature({Svg, title, description}) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        {/* <Svg className={styles.featureSvg} alt={title} /> */}
      </div>
      <div className="text--center padding-horiz--md">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
