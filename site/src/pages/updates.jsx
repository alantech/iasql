import React, { useState } from 'react';
import Layout from '@theme/Layout';

const INIT = "INIT";
const SUBMITTING = "SUBMITTING";
const ERROR = "ERROR";
const SUCCESS = "SUCCESS";
const formStyles = {
  "id": "cle3aaabg0025l30f3f5mewao",
  "formStyle": "buttonBelow",
  "placeholderText": "you@example.com",
  "formFont": "Roboto",
  "formFontColor": "#000000",
  "formFontSizePx": 14,
  "buttonText": "Subscribe",
  "successMessage": "Awesome! We'll be in touch!",
  "successFont": "Roboto",
  "successFontColor": "#000000",
  "successFontSizePx": 14,
  "userGroup": "newsletter"
}
const domain = "app.loops.so"

function SignUpFormReact() {
  const [email, setEmail] = useState("");
  const [formState, setFormState] = useState(INIT);
  const [errorMessage, setErrorMessage] = useState("");

  const resetForm = () => {
    setEmail("");
    setFormState(INIT);
    setErrorMessage("");
  };

  /**
   * Rate limit the number of submissions allowed
   * @returns {boolean} true if the form has been successfully submitted in the past minute
   */
  const hasRecentSubmission = () => {
    const time = new Date();
    const timestamp = time.valueOf();
    const previousTimestamp = localStorage.getItem("loops-form-timestamp");

    // Indicate if the last sign up was less than a minute ago
    if (
      previousTimestamp &&
      Number(previousTimestamp) + 60 * 1000 > timestamp
    ) {
      setFormState(ERROR);
      setErrorMessage("Too many signups, please try again in a little while");
      return true;
    }

    localStorage.setItem("loops-form-timestamp", timestamp.toString());
    return false;
  };

  const handleSubmit = (event) => {
    // Prevent the default form submission
    event.preventDefault();

    // boundary conditions for submission
    if (formState !== INIT) return;
    if (!isValidEmail(email)) {
      setFormState(ERROR);
      setErrorMessage("Please enter a valid email");
      return;
    }
    if (hasRecentSubmission()) return;
    setFormState(SUBMITTING);

    // build body
    const formBody = `userGroup=${encodeURIComponent(
      formStyles.userGroup
    )}&email=${encodeURIComponent(email)}`;

    // API request to add user to newsletter
    fetch(`https://${domain}/api/newsletter-form/${formStyles.id}`, {
      method: "POST",
      body: formBody,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    })
      .then((res) => [res.ok, res.json(), res])
      .then(([ok, dataPromise, res]) => {
        if (ok) {
          resetForm();
          setFormState(SUCCESS);
        } else {
          dataPromise.then((data) => {
            setFormState(ERROR);
            setErrorMessage(data.message || res.statusText);
            localStorage.setItem("loops-form-timestamp", "");
          });
        }
      })
      .catch((error) => {
        setFormState(ERROR);
        // check for cloudflare error
        if (error.message === "Failed to fetch") {
          setErrorMessage("Too many signups, please try again in a little while");
        } else if (error.message) {
          setErrorMessage(error.message);
        }
        localStorage.setItem("loops-form-timestamp", "");
      });
  };

  const isInline = formStyles.formStyle === "inline";

  switch (formState) {
    case SUCCESS:
      return (
        <div className="col col--6 col--offset-3">
          <div className="alert alert--success" role="alert">
            {formStyles.successMessage}
          </div>
        </div>
      );
    case ERROR:
      return (
        <>
          <SignUpFormError />
          <BackButton />
        </>
      );
    default:
      return (
        <>
          <form
            onSubmit={handleSubmit}
            style={{
              display: "flex",
              flexDirection: isInline ? "row" : "column",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
            }}
          >
            <input
              type="text"
              name="email"
              placeholder={formStyles.placeholderText}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required={true}
              style={{
                color: formStyles.formFontColor,
                fontFamily: `'${formStyles.formFont}', sans-serif`,
                fontSize: `${formStyles.formFontSizePx}px`,
                margin: isInline ? "0px 10px 0px 0px" : "0px 0px 10px",
                width: "100%",
                maxWidth: "300px",
                minWidth: "100px",
                background: "#FFFFFF",
                border: "1px solid #D1D5DB",
                boxSizing: "border-box",
                boxShadow: "rgba(0, 0, 0, 0.05) 0px 1px 2px",
                borderRadius: "6px",
                padding: "8px 12px",
              }}
            />
            <SignUpFormButton />
          </form>
        </>
      );
  }

  function SignUpFormError() {
    return (
        <div className="col col--6 col--offset-3">
          <div className="alert alert--danger" role="alert">
            {errorMessage || "Oops! Something went wrong, please try again"}
          </div>
        </div>
    );
  }

  function BackButton() {
    return (  
      <button
        className="button button--primary button--outline button--lg margin--lg"
        onClick={resetForm}
      >
        &larr; Back
      </button>
    );
  }

  function SignUpFormButton({ props }) {
    return (
      <button className="button button--primary button--lg margin--lg" type="submit">
        {formState === SUBMITTING ? "Please wait..." : formStyles.buttonText}
      </button>
    );
  }
}

function isValidEmail(email) {
  return /.+@.+/.test(email);
}

export default function Updates() {
  return (
    <Layout title="Updates" description="Cloud infrastructure as data in PostgreSQL">
      <div className="container text--center">
        <div className="row padding--lg">
          <div className="col">
            <h1>Stay up to date 📬</h1>
            <p className="hero__subtitle">Be the first to know when we ship new features and updates!</p>
            <div className="padding--md">
              <SignUpFormReact/>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}