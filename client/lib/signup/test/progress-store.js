/**
 * @format
 * @jest-environment jsdom
 */

/**
 * External dependencies
 */
import assert from 'assert'; // eslint-disable-line import/no-nodejs-modules
import { defer, find, last, omit } from 'lodash';
import sinon from 'sinon';

/**
 * Internal dependencies
 */
import Dispatcher from 'dispatcher';
import flows from 'signup/config/flows';

jest.mock( 'lib/user', () => () => {} );
jest.mock( 'signup/config/steps', () => require( './mocks/signup/config/steps' ) );
jest.mock( 'signup/config/flows', () => ( {
	getFlow: jest.fn(),
} ) );

describe( 'progress-store', () => {
	let SignupProgressStore, SignupActions;

	beforeAll( () => {
		SignupProgressStore = require( '../progress-store' );
		SignupActions = require( '../actions' );
	} );

	test( 'should return an empty at first', () => {
		assert.equal( SignupProgressStore.get().length, 0 );
	} );

	test( 'should store a new step', () => {
		SignupActions.submitSignupStep( {
			stepName: 'site-selection',
			formData: { url: 'my-site.wordpress.com' },
		} );

		assert.equal( SignupProgressStore.get().length, 1 );
		assert.equal( SignupProgressStore.get()[ 0 ].stepName, 'site-selection' );
	} );

	describe( 'timestamps', () => {
		let clock;

		beforeEach( () => {
			clock = sinon.useFakeTimers( 12345 );
		} );

		afterEach( () => {
			clock.restore();
		} );

		test( 'should be updated at each step', () => {
			Dispatcher.handleViewAction( {
				type: 'SAVE_SIGNUP_STEP',
				data: {
					stepName: 'site-selection',
				},
			} );

			assert.equal( SignupProgressStore.get()[ 0 ].lastUpdated, 12345 );
		} );
	} );

	test( 'should not store the same step twice', () => {
		SignupActions.submitSignupStep( { stepName: 'site-selection' } );

		assert.equal( SignupProgressStore.get().length, 1 );
		assert.deepEqual( omit( SignupProgressStore.get()[ 0 ], 'lastUpdated' ), {
			stepName: 'site-selection',
			formData: { url: 'my-site.wordpress.com' },
			status: 'completed',
		} );
	} );

	test( 'should not be possible to mutate', () => {
		assert.equal( SignupProgressStore.get().length, 1 );

		// attempt to mutate
		SignupProgressStore.get().pop();

		assert.equal( SignupProgressStore.get().length, 1 );
	} );

	test( 'should store multiple steps in order', () => {
		SignupActions.submitSignupStep( { stepName: 'theme-selection' } );

		assert.equal( SignupProgressStore.get().length, 2 );
		assert.equal( SignupProgressStore.get()[ 0 ].stepName, 'site-selection' );
		assert.equal( SignupProgressStore.get()[ 1 ].stepName, 'theme-selection' );
	} );

	test( 'should mark submitted steps without an API request method as completed', () => {
		SignupActions.submitSignupStep( { stepName: 'step-without-api' } );

		assert.equal(
			find( SignupProgressStore.get(), { stepName: 'step-without-api' } ).status,
			'completed'
		);
	} );

	test( 'should mark submitted steps with an API request method as pending', () => {
		SignupActions.submitSignupStep( {
			stepName: 'asyncStep',
		} );

		assert.equal( find( SignupProgressStore.get(), { stepName: 'asyncStep' } ).status, 'pending' );
	} );

	test( 'should mark only new saved steps as in-progress', () => {
		SignupActions.saveSignupStep( { stepName: 'site-selection' } );
		defer( () => {
			assert.notEqual( SignupProgressStore.get()[ 0 ].status, 'in-progress' );
		} );

		SignupActions.saveSignupStep( { stepName: 'last-step' } );
		defer( () => {
			assert.equal( last( SignupProgressStore.get() ).status, 'in-progress' );
		} );
	} );

	test( 'should set the status of a signup step', () => {
		SignupActions.submitSignupStep( { stepName: 'site-selection' } );
		assert.equal( SignupProgressStore.get()[ 0 ].status, 'completed' );

		SignupActions.processedSignupStep( { stepName: 'site-selection' } );
		assert.equal( SignupProgressStore.get()[ 0 ].status, 'completed' );
	} );

	test( 'should remove unneeded steps when flow changes', () => {
		assert.ok( SignupProgressStore.get().length > 1 );

		flows.getFlow.mockReturnValueOnce( { steps: [ 'site-selection' ] } );
		SignupActions.changeSignupFlow( 'new-flow' );

		assert.equal( SignupProgressStore.get().length, 1 );

		flows.getFlow.mockReturnValueOnce( { steps: [ 'no-step-matches' ] } );
		SignupActions.changeSignupFlow( 'another-new-flow' );

		assert.equal( SignupProgressStore.get().length, 0 );
	} );
} );
