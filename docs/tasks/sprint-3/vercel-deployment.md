---
id: vercel-deployment
assignee: Junyu
sprint: 3
estimate_hours: 4
---

# Vercel Deployment & Production Integration

## Description

The Smart Scheduling App needs a stable and accessible deployment for the final product demonstration. While the application has previously been deployed to Vercel, the deployed version may not contain the latest changes from the GitHub repository.

This task focuses on updating and maintaining the Vercel deployment, configuring Google OAuth authentication, and verifying that the frontend, backend, and agent service can communicate correctly in the deployed environment.

The goal is to ensure that the latest working version of the application can be accessed through a public URL and is ready for the final demonstration.

## Specs

The Vercel deployment and integration task consists of:

1. **Vercel Deployment Configuration**
   - Verify that the Vercel project is connected to the correct GitHub repository.
   - Ensure that the deployment configuration supports the application's frontend and backend structure.
   - Update the deployed application to include the latest integrated changes.
   - Verify that the application builds and deploys successfully.

2. **Environment Variables and Google OAuth**
   - Configure the required environment variables in Vercel.
   - Verify the Google OAuth Client ID and Client Secret configuration.
   - Ensure that OAuth redirect URIs match the deployed application.
   - Keep sensitive credentials out of the GitHub repository.

3. **Frontend and Backend Integration**
   - Verify that the deployed React frontend can communicate with the Node.js backend.
   - Ensure that API requests use the correct production endpoints.
   - Verify that authentication requests and responses are handled correctly.
   - Check for deployment-specific errors, including incorrect API paths and environment configuration.

4. **Agent Service Integration**
   - Verify that the backend can communicate with the agent service in the deployed environment.
   - Ensure that agent requests and responses are handled correctly.
   - Confirm that deployment configuration supports the application's scheduling workflow.

5. **Final Demo Readiness**
   - Verify that the deployed application is accessible through a public URL.
   - Confirm that the deployment contains the latest working version of the application.
   - Test the main user workflow in the deployed environment.
   - Identify and resolve deployment-related issues before the final demonstration.

## Requirements

1. **Public Accessibility**: The application must be accessible through a working Vercel URL.

2. **Deployment Updates**: The Vercel project must support deploying the latest integrated application changes.

3. **Environment Configuration**: Required production environment variables must be configured correctly without exposing sensitive credentials.

4. **Google OAuth**: Google authentication must work correctly in the deployed environment.

5. **API Communication**: The frontend must communicate with the backend using the correct production API endpoints.

6. **Agent Connectivity**: The backend must be able to communicate with the agent service when the service is available.

7. **Error Handling**: Deployment-related failures must be identifiable through logs or appropriate error messages.

8. **Build Stability**: The deployment process must complete without build or configuration errors.

## Acceptance Criteria

- **AC1**: The Smart Scheduling App can be opened successfully using its public Vercel URL.
- **AC2**: The deployed application contains the latest intended version of the integrated codebase.
- **AC3**: All required production environment variables are configured in Vercel without exposing secrets in source control.
- **AC4**: Google OAuth authentication completes successfully using the production configuration.
- **AC5**: The deployed frontend can send requests to the backend and receive valid responses.
- **AC6**: The backend can successfully communicate with the deployed agent service and receive a valid response.
- **AC7**: The main scheduling workflow can be tested in the deployed application once the required features are integrated.
- **AC8**: A new deployment can be completed successfully without manual changes to application source code.
- **AC9**: The deployed application is ready for verification and final demo preparation by Monday, November 30, 2026.

## Tests

1. **Deployment Smoke Test**
   - Open the public Vercel URL.
   - Verify that the application loads without deployment-related errors.
   - Confirm that the expected frontend interface is displayed.

2. **Google OAuth Test**
   - Initiate Google login from the deployed application.
   - Verify successful authentication and redirection.
   - Confirm that the application handles the authenticated session correctly.

3. **Frontend-Backend Communication Test**
   - Trigger an API request from the deployed frontend.
   - Verify that the backend receives the request and returns the expected response.

4. **Agent Integration Test**
   - Submit a scheduling-related request through the application.
   - Verify that the backend can reach the agent service.
   - Confirm that the response is returned to the application correctly.

5. **Redeployment Test**
   - Deploy the latest integrated code.
   - Verify that the deployment succeeds.
   - Confirm that the updated application is accessible through the production URL.

## Deliverables

- Updated Vercel deployment configuration, if required.
- Configured production environment variables.
- Accessible public deployment URL.
- Verified frontend, backend, and agent service integration.
- Deployment-related documentation and test evidence.
