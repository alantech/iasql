import React from 'react';
import Layout from '@theme/Layout';
import ThemedImage from '@theme/ThemedImage';
import useBaseUrl from '@docusaurus/useBaseUrl';

function BrowserWindow(props) {
  return (
    <div className="browser-window">
      <div className="browser-top">
        <span className="browser-dot"></span>
        <span className="browser-dot"></span>
        <span className="browser-dot"></span>
      </div>
      {props.children}
    </div>
  )
}

export default function Home() {
  return (
    <Layout title="Home" description="Cloud infrastructure as data in PostgreSQL" disableSwitch={true}>
      <div className="hero hero--iasql">
        <div className="container">
          <div className="row">
            <div className="col col--6 padding--md">
              <h1 className="hero__title">Infrastructure as data in PostgreSQL</h1>
              <p className="hero__subtitle">Manage and provision cloud infrastructure via a hosted PostgreSQL database. Simpler than IaC or the AWS UI</p>
              <div>
                <button className="button button--primary button--lg" onClick={() => window.location.href="https://app.iasql.com"}>Connect an AWS account</button>
              </div>
            </div>
            <div className="col col--6">
              <BrowserWindow>
                <ThemedImage
                  alt="Create EC2 Instance"
                  className='shadow--tl browser-content'
                  onClick={() => window.location.href="https://app.iasql.com#/button/INSERT%20INTO%20instance%20%28ami%2C%20instance_type%2C%20tags%29%0A%20%20VALUES%20%28%27resolve%3Assm%3A%2Faws%2Fservice%2Fcanonical%2Fubuntu%2Fserver%2F20.04%2Fstable%2Fcurrent%2Famd64%2Fhvm%2Febs-gp2%2Fami-id%27%2C%20%27t2.micro%27%2C%20%27%7B%22name%22%3A%22i-1%22%7D%27%29%3B%0A%0AINSERT%20INTO%20instance_security_groups%20%28instance_id%2C%20security_group_id%29%20SELECT%0A%20%20%28SELECT%20id%20FROM%20instance%20WHERE%20tags%20-%3E%3E%20%27name%27%20%3D%20%27i-1%27%29%2C%0A%20%20%28SELECT%20id%20FROM%20security_group%20WHERE%20group_name%3D%27default%27%20AND%20vpc_id%20%3D%20%28SELECT%20id%20FROM%20vpc%20WHERE%20is_default%20%3D%20true%20AND%20region%3Ddefault_aws_region%28%29%29%3B"}
                  sources={{
                    light: useBaseUrl('/img/ec2-typewriter.gif'),
                    dark: useBaseUrl('/img/ec2-typewriter_dark.gif'),
                  }}
                />
              </BrowserWindow>
            </div>
          </div>
        </div>
      </div>
      <div className="hero">
        <div className="container">
          <div className="row padding--md text--center">
            <h1 style={{width: '100%'}}>How IaSQL works</h1>
            <p className="hero__subtitle">IaSQL is an open-source SaaS that models cloud infrastructure as data by maintaining a 2-way connection between an AWS account and a hosted PostgreSQL database</p>
          </div>
          <div className="text--center">
            <ThemedImage
              alt="Two way connection"
              style={{width: '60%'}}
              sources={{
                light: useBaseUrl('/img/iasql-connector.gif'),
                dark: useBaseUrl('/img/iasql-connector_dark.gif'),
              }}
            />
          </div>
        </div>
      </div>
      <div className="hero hero--iasql">
        <div className="container">
          <div className="row padding--lg">
            <div className="col col--4 padding--sm">
              <div class="card">
                <div class="card__header">
                  <h3>Automatically import existing infrastructure</h3>
                </div>
                <div class="card__body">
                  <p>
                  Connect an AWS account to a hosted IaSQL DB to automatically backfill the database with your existing cloud resources. No need to redefine or reconcile existing infrastructure.
                  </p>
                </div>
              </div>
            </div>
            <div className="col col--4 padding--sm">
              <div class="card">
                <div class="card__header">
                  <h3>Don't learn a new API (Probably)</h3>
                </div>
                <div class="card__body">
                  <p>
                    No learning curve if you are already familiar with SQL. We provide an unmodified PostgreSQL database. Use any migration system, ORM or database connector.
                  </p>
                </div>
              </div>
            </div>
            <div className="col col--4 padding--sm">
              <div class="card">
                <div class="card__header">
                  <h3>The definitive state of your cloud</h3>
                </div>
                <div class="card__body">
                  <p>
                  IaSQL's module system lets you specify which parts of your cloud infrastructure you wish to control as tables in PostgreSQL                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="row padding--lg">
            {/* TODO generate new screens */}
            <BrowserWindow>
              <ThemedImage
                alt="Dashboard"
                className='shadow--tl browser-content'
                sources={{
                  light: useBaseUrl('/screenshots/dashboard.png'),
                  dark: useBaseUrl('/screenshots/dashboard.png'),
                }}
              />
            </BrowserWindow>
          </div>
        </div>
      </div>
      <div className="hero">
        <div className="container">
          <div className="row padding--md text--center">
            <h1 style={{width: '100%'}}>Backed by</h1>
          </div>
          <div className="text--center">
            <img style={{width: '60%'}} src={useBaseUrl('/img/investors.png')}></img>
          </div>
        </div>
      </div>
      <div className="hero padding-bottom--xl">
        <div className="container">
          <div className="row text--center">
            <h1 style={{width: '100%'}}>Ready to get started?</h1>
          </div>
          <div className="text--center">
            <p className="hero__subtitle">Drop us a line on Discord if you have any questions!</p>
            <button className="button button--primary button--lg" onClick={() => window.location.href="https://app.iasql.com"}>Connect an AWS account</button>
          </div>
        </div>
      </div>
    </Layout>
  );
}